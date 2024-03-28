local opts = {}

function opts.init()
        -- Options de base de vim neovim
        local opt = vim.opt

        opt.autoread = true -- Relire un fichier automatiquement quand il a ete modifié en dehors de neovim
        opt.encoding = 'UTF-8'
        opt.number = true -- Avoir les numero de ligne dans la colonne de gauche
        opt.mouse = "a" -- Activer le support de la souris dans tous les modes
        opt.list = true -- Afficher les symboles d'espace comme tab, retour ligne etc..
        opt.listchars:append("eol:⌁") -- Ajouter le symbol de saut de ligne a chaque fin de ligne
        opt.signcolumn = "yes" -- Afficher la colonne de signes a gauche (utile pour LSP)
        opt.wrap = false -- Ne pas representer une ligne d'un buffer sur plusieur lignes dans le termina.
        opt.splitright = true -- Focus sur la window de droite quand on split verticalement
        opt.splitbelow = true -- Focus sur la window de en bis quand on split horizontalement.
        opt.confirm = true -- Demander la confirmation quand on ferme n buffer qui n'est pas saved demander la contirmation auand on forme un butter aul n'est pas saved.
        opt.cursorline = true -- Highlight sur quelle ligne le curseur est actuellement
        opt.expandtab = true -- Utilise des espaces pour les tabs au lieu du char tab
        opt.smartindent = true -- Indenter automatiquement
        opt.winbar = "" --Desactiver la winbar
end

return opts
