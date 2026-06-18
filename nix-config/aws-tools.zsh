# ─────────────────────────────────────────────────────────────────────────────
# Outils AWS (zsh + fzf) : awsp = sélecteur de profil · awst = tunnel SSM vers RDS
# Sourcé depuis ~/.zshrc (via home.nix → programs.zsh.initExtra).
# Prérequis (tous fournis par Nix) : aws-cli v2, fzf, jq, session-manager-plugin.
# ─────────────────────────────────────────────────────────────────────────────

# Options fzf locales : on reprend le thème complet (style full + couleurs du
# thème global) MAIS sans le --preview bat ni les --bind focus:file, pensés pour
# un file picker et qui cassent un sélecteur de données. Chaque sélecteur greffe
# ensuite son propre --preview (infos profil / RDS / instance).
# NB : ces couleurs dupliquent le thème de home.nix (programs.zsh.initExtra) ;
# si tu retouches ta palette fzf, répercute-la ici.
_AWS_FZF_OPTS="--style full --reverse --border-label ' AWS ' \
--color=fg:#e0e0e0,bg:#1a1a1a,hl:#D4825D,fg+:#e0e0e0,bg+:#3a3a3a,hl+:#D4825D \
--color=info:#7AB8FF,prompt:#D4825D,pointer:#D4825D,marker:#86E89A,spinner:#C79BFF,header:#999999 \
--color=border:#3a3a3a,label:#D4825D,preview-border:#D4825D,preview-label:#e0e0e0 \
--color=list-border:#3a3a3a,list-label:#86E89A,input-border:#D4825D,input-label:#e0e0e0,header-border:#3a3a3a,header-label:#999999"

# Preview d'un profil AWS : {1} = nom du profil. Tourne dans le shell du preview.
_AWS_PROFILE_PREVIEW='p={1}
aws configure get sso_account_id --profile "$p" >/dev/null 2>&1 || { echo "$p"; exit 0; }
printf "Profil   : %s\nCompte   : %s\nRôle     : %s\nRégion   : %s\nSession  : %s\n" \
  "$p" \
  "$(aws configure get sso_account_id --profile "$p")" \
  "$(aws configure get sso_role_name  --profile "$p")" \
  "$(aws configure get region         --profile "$p")" \
  "$(aws configure get sso_session     --profile "$p")"'

# awsp [filtre] : choisit un profil AWS (fzf, colonnes profil/compte/région),
# l'exporte dans le shell courant, et lance `aws sso login` si la session a expiré.
awsp() {
  command -v fzf >/dev/null || { echo "fzf requis"; return 1; }
  local sel profile p acct region
  sel=$(
    {
      printf 'PROFILE\tACCOUNT\tREGION\n'
      for p in $(aws configure list-profiles 2>/dev/null | sort); do
        acct=$(aws configure get sso_account_id --profile "$p" 2>/dev/null)
        [[ -z $acct ]] && acct=$(aws configure get account_id --profile "$p" 2>/dev/null)
        region=$(aws configure get region --profile "$p" 2>/dev/null)
        printf '%s\t%s\t%s\n' "$p" "${acct:-–}" "${region:-–}"
      done
    } | column -t -s $'\t' \
      | FZF_DEFAULT_OPTS="$_AWS_FZF_OPTS" fzf \
          --header-lines=1 --height=50% --prompt='AWS profile > ' --query="${1:-}" \
          --preview-window='right,48%,wrap' --preview "$_AWS_PROFILE_PREVIEW"
  ) || return
  profile=${sel%% *}
  [[ -z $profile ]] && return
  export AWS_PROFILE="$profile"
  if ! aws sts get-caller-identity >/dev/null 2>&1; then
    echo "Session expirée → aws sso login ($profile)…"
    aws sso login --profile "$profile" || return
  fi
  echo "✓ AWS_PROFILE=$AWS_PROFILE ($(aws sts get-caller-identity --query Account --output text 2>/dev/null))"
}

# awst : ouvre un tunnel SSM (port-forwarding) vers une RDS.
# Choix : profil → RDS → bastion (EC2 SSM-managed du VPC de la RDS, auto/fzf).
# Le tunnel reste ouvert au premier plan (Ctrl-C pour fermer).
awst() {
  command -v fzf >/dev/null || { echo "fzf requis"; return 1; }
  local profile region
  profile=$(aws configure list-profiles 2>/dev/null | sort \
            | FZF_DEFAULT_OPTS="$_AWS_FZF_OPTS" fzf \
                --height=50% --prompt='Profil AWS > ' --query="${AWS_PROFILE:-}" \
                --preview-window='right,48%,wrap' --preview "$_AWS_PROFILE_PREVIEW")
  [[ -z $profile ]] && return
  region=$(aws configure get region --profile "$profile" 2>/dev/null); region=${region:-eu-west-3}

  if ! aws sts get-caller-identity --profile "$profile" >/dev/null 2>&1; then
    echo "Session expirée → aws sso login ($profile)…"
    aws sso login --profile "$profile" || return
  fi

  echo "Recherche des RDS sur $profile / $region…"
  local rds
  rds=$(
    aws rds describe-db-instances --profile "$profile" --region "$region" \
      --query 'DBInstances[].[DBInstanceIdentifier,Endpoint.Address,Endpoint.Port,DBSubnetGroup.VpcId,Engine,DBInstanceStatus,MasterUsername]' \
      --output text 2>/dev/null | sort \
      | FZF_DEFAULT_OPTS="$_AWS_FZF_OPTS" fzf \
          --height=60% --prompt='RDS > ' --with-nth=1,5,6 --header='id · engine · statut' \
          --preview-window='right,50%,wrap' \
          --preview 'printf "RDS      : %s\nEndpoint : %s\nPort     : %s\nEngine   : %s\nStatut   : %s\nUser     : %s\nVPC      : %s\n" {1} {2} {3} {5} {6} {7} {4}'
  ) || return
  [[ -z $rds ]] && { echo "Aucune RDS sélectionnée."; return; }

  local db_id endpoint port vpc master
  db_id=$(awk '{print $1}'   <<< "$rds")
  endpoint=$(awk '{print $2}' <<< "$rds")
  port=$(awk '{print $3}'    <<< "$rds")
  vpc=$(awk '{print $4}'     <<< "$rds")
  master=$(awk '{print $7}'  <<< "$rds")

  # Jump host : priorité aux EC2 *bastion* du VPC (SSM-managed). À défaut,
  # fallback sur les EC2 dont un SG est autorisé à joindre la RDS sur son port.
  local ssm_ids
  ssm_ids=$(aws ssm describe-instance-information --profile "$profile" --region "$region" \
    --query 'InstanceInformationList[?PingStatus==`Online`].InstanceId' --output text 2>/dev/null)
  [[ -z $ssm_ids ]] && { echo "Aucune EC2 SSM-managed (Online) sur $profile."; return 1; }

  # Candidats SSM (Online, running) du VPC : id, nom, liste de SGs
  local cand
  cand=$(aws ec2 describe-instances --profile "$profile" --region "$region" \
    --instance-ids ${=ssm_ids} \
    --filters "Name=vpc-id,Values=$vpc" "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].[InstanceId,Tags[?Key==`Name`]|[0].Value,join(`,`,SecurityGroups[].GroupId)]' \
    --output text 2>/dev/null)
  [[ -z $cand ]] && { echo "Aucune EC2 SSM-managed dans le VPC $vpc de la RDS $db_id."; return 1; }

  local pool note bastion
  local bastions
  bastions=$(awk -F'\t' 'tolower($2) ~ /bastion/ {print $1"\t"$2}' <<< "$cand")
  if [[ -n $bastions ]]; then
    pool=$bastions; note="bastions du VPC"
  else
    # Fallback : EC2 dont un SG est autorisé à joindre la RDS sur $port
    local rds_sgs allowed authorized="" id name sgs a
    rds_sgs=$(aws rds describe-db-instances --db-instance-identifier "$db_id" --profile "$profile" --region "$region" \
      --query 'DBInstances[0].VpcSecurityGroups[?Status==`active`].VpcSecurityGroupId' --output text 2>/dev/null)
    allowed=$(aws ec2 describe-security-groups --group-ids ${=rds_sgs} --profile "$profile" --region "$region" \
      --output json 2>/dev/null \
      | jq -r --argjson p "$port" '.SecurityGroups[].IpPermissions[] | select(.FromPort==$p) | .UserIdGroupPairs[].GroupId' 2>/dev/null | sort -u)
    while IFS=$'\t' read -r id name sgs; do
      [[ -z $id ]] && continue
      for a in ${=allowed}; do
        if [[ ",$sgs," == *",$a,"* ]]; then authorized+="$id"$'\t'"$name"$'\n'; break; fi
      done
    done <<< "$cand"
    if [[ -n $authorized ]]; then
      echo "ℹ Aucun bastion dans le VPC → EC2 autorisées sur $port."
      pool=$authorized; note="autorisées sur $port"
    else
      echo "⚠ Aucun bastion ni EC2 autorisée — choix parmi toutes les EC2 SSM du VPC."
      pool=$(awk -F'\t' '{print $1"\t"$2}' <<< "$cand"); note="non filtrées"
    fi
  fi

  if [[ $(grep -c . <<< "$pool") -eq 1 ]]; then
    bastion=$(awk '{print $1}' <<< "$pool")
  else
    bastion=$(echo "$pool" \
      | FZF_DEFAULT_OPTS="$_AWS_FZF_OPTS" fzf \
          --height=50% --prompt='Jump host > ' --header="EC2 SSM ($note)" \
          --preview-window='right,45%,wrap' \
          --preview 'printf "Instance : %s\nName     : %s\n" {1} {2}' \
      | awk '{print $1}')
  fi
  [[ -z $bastion ]] && return

  # Port local libre à partir de 3307 (laisse 3306 au MySQL Docker local)
  local lport=3307
  while lsof -nP -iTCP:$lport -sTCP:LISTEN >/dev/null 2>&1; do ((lport++)); done

  echo ""
  echo "▶ 127.0.0.1:$lport → $db_id ($endpoint:$port)"
  echo "  via bastion $bastion · profil $profile · user '$master'"
  echo "  (Ctrl-C pour fermer)"
  echo ""
  aws ssm start-session --profile "$profile" --region "$region" \
    --target "$bastion" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"$endpoint\"],\"portNumber\":[\"$port\"],\"localPortNumber\":[\"$lport\"]}"
}
