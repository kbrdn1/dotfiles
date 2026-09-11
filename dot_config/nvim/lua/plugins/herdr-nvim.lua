-- Moitié nvim du plugin herdr chmarax.herdr-nvim : annotations et envoi vers
-- un agent. Côté herdr, prefix+a bascule la sidebar et prefix+f ouvre le
-- picker (voir ~/.config/herdr/config.toml).
--
-- Le préfixe par défaut est <leader>a, déjà le namespace Claude ici : le
-- plugin refuse alors <leader>ac/as/aS et le dit une fois au chargement,
-- après quoi les commandes manquent sans rien signaler. <leader>h est libre.
return {
  "ChmaraX/herdr-nvim",
  opts = { prefix = "<leader>h" },
}
