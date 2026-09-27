// =====================================================================
// MinVa — Console Développeur (réservée au fondateur)
// =====================================================================
(function () {
  var O = window.MVO, DV = window.DV, esc = O.esc, ico = O.ico;
  var racine = document.getElementById('racine');
  var S = { moi: null, clients: [], demandes: [], docs: [], erreurs: [], activite: [], filtre: '', statut: 'tous', inspection: null };
  var TARIFS = { essentiel: 'Essentiel', organisation: 'Organisation', reseau: 'Réseau' };
  var ONGLETS = [['veille', 'Veille technique', 'graph'], ['clients', 'Clients', 'boite'], ['demandes', 'Demandes', 'envoi'], ['documents', 'Documents à vérifier', 'rapport'], ['erreurs', 'Erreurs', 'alerte']];

  function page() { var h = location.hash.slice(1); return ONGLETS.some(function (o) { return o[0] === h; }) || h === 'inspection' ? h : 'veille'; }
  function erreur(e) { O.toast(e.message || String(e), 'erreur'); }
  function occupe(b, oui, t) { if (!b) return; if (oui) { b.dataset.txt = b.innerHTML; b.disabled = true; b.innerHTML = t || 'Un instant…'; } else { b.disabled = false; if (b.dataset.txt) b.innerHTML = b.dataset.txt; } }
  function joursRestants(d) { return d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null; }

  var fen = document.getElementById('fenetre');
  document.getElementById('fen-fermer').innerHTML = ico('fermer', 'ico-lg');
  document.getElementById('fen-fermer').onclick = function () { fen.close(); };
  function fenetre(titre, corps, pied) {
    document.getElementById('fen-titre').textContent = titre;
    document.getElementById('fen-corps').innerHTML = corps;
    document.getElementById('fen-pied').innerHTML = pied || ''; document.getElementById('fen-pied').hidden = !pied;
    fen.showModal();
  }

  // ---------------- Connexion ----------------
  function connexion(msg) {
    racine.innerHTML = '<div class="cx"><div class="bogolan"></div><form id="f" novalidate><img src="logo-blanc.png" alt="MinVa" width="160" height="50"><div><h1>Console Développeur</h1><p class="code">accès restreint · rôle « developpeur »</p></div>' +
      (msg ? '<div class="erreur-form" role="alert">' + ico('alerte') + '<span>' + esc(msg) + '</span></div>' : '') +
      '<div class="champ"><label for="e">Email</label><input id="e" type="email" autocomplete="username"></div><div class="champ"><label for="m">Mot de passe</label><input id="m" type="password" autocomplete="current-password"></div>' +
      '<button class="btn btn-noir btn-bloc" id="ok" type="submit">Entrer</button>' +
      (DV.mode === 'demo' ? '<p class="note">Démo : <b>dev@minva.demo</b> / <b>demo1234</b> <button type="button" class="btn btn-lien" id="remplir">remplir</button></p>' : '') + '</form></div>';
    var r = document.getElementById('remplir'); if (r) r.onclick = function () { document.getElementById('e').value = 'dev@minva.demo'; document.getElementById('m').value = 'demo1234'; };
    document.getElementById('f').onsubmit = function (e) {
      e.preventDefault(); occupe(document.getElementById('ok'), true);
      DV.auth.connexion(document.getElementById('e').value, document.getElementById('m').value).then(demarrer).catch(function (er) { connexion(er.message); });
    };
  }

  function demarrer() {
    return Promise.all([DV.auth.profil(), DV.clients(), DV.demandes(), DV.docsAVerifier(), DV.erreurs(), DV.activite(14)]).then(function (r) {
      S.moi = r[0]; S.clients = r[1]; S.demandes = r[2]; S.docs = r[3]; S.erreurs = r[4]; S.activite = r[5];
      coque(); afficher();
    });
  }
  function rafraichir() { return demarrer(); }

  function coque() {
    racine.innerHTML = '<header class="barre"><div class="barre-in"><img src="logo-blanc.png" alt="MinVa" width="108" height="34"><span class="tag' + (DV.mode === 'demo' ? ' demo' : '') + '">' + (DV.mode === 'demo' ? 'démo' : 'production') + '</span>' +
      '<div class="droite"><span class="qui">' + esc(S.moi.nom) + '</span><button type="button" id="rafr">' + ico('horloge') + 'Actualiser</button>' +
      (DV.mode === 'demo' ? '<button type="button" id="reset">Réinitialiser la démo</button>' : '') + '<button type="button" id="sortie">' + ico('sortie') + 'Sortir</button></div></div></header>' +
      '<nav class="onglets" aria-label="Console"><div class="onglets-in" id="nav"></div></nav><main class="contenu" id="contenu"></main>';
    document.getElementById('sortie').onclick = function () { DV.auth.deconnexion().then(function () { location.hash = ''; connexion(); }); };
    document.getElementById('rafr').onclick = function () { rafraichir().then(function () { O.toast('Données actualisées.'); }).catch(erreur); };
    var rs = document.getElementById('reset'); if (rs) rs.onclick = function () { DV.reinitialiserDemo(); location.hash = ''; location.reload(); };
  }
  function nav() {
    var p = page(), nb = { demandes: S.demandes.filter(function (d) { return d.statut === 'nouvelle'; }).length, documents: S.docs.length,
      erreurs: S.erreurs.filter(function (e) { return O.joursDepuis(e.created_at) < 1; }).length };
    document.getElementById('nav').innerHTML = ONGLETS.map(function (o) {
      return '<a href="#' + o[0] + '"' + (o[0] === p || (p === 'inspection' && o[0] === 'clients') ? ' aria-current="page"' : '') + '>' + ico(o[2]) + o[1] + (nb[o[0]] ? '<span class="n">' + nb[o[0]] + '</span>' : '') + '</a>';
    }).join('');
  }
  function afficher() {
    if (!S.moi) return;
    nav();
    var c = document.getElementById('contenu');
    ({ veille: pVeille, clients: pClients, demandes: pDemandes, documents: pDocs, erreurs: pErreurs, inspection: pInspection })[page()](c);
  }
  window.addEventListener('hashchange', function () { if (S.moi) afficher(); });

  // =================================================================
  // VEILLE TECHNIQUE
  // =================================================================
  function graphique() {
    var jours = [], W = 560, H = 180, g = 28, b = 22;
    for (var i = 13; i >= 0; i--) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); jours.push({ d: d, n: 0 }); }
    S.activite.forEach(function (t) { var x = new Date(t); x.setHours(0, 0, 0, 0); var j = jours.find(function (k) { return k.d.getTime() === x.getTime(); }); if (j) j.n++; });
    var max = Math.max(4, Math.max.apply(null, jours.map(function (j) { return j.n; })));
    var pas = Math.ceil(max / 4); max = pas * 4;
    var larg = (W - g - 8) / 14, h = H - b - 10;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Actualités publiées par jour, 14 derniers jours">';
    for (var k = 0; k <= 4; k++) { var y = 10 + h - (k * pas / max) * h; s += '<line class="grille" x1="' + g + '" x2="' + (W - 8) + '" y1="' + y + '" y2="' + y + '"/><text class="axe" x="' + (g - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + (k * pas) + '</text>'; }
    jours.forEach(function (j, i) {
      var bh = (j.n / max) * h, x = g + i * larg + larg * 0.18, y = 10 + h - bh;
      s += '<rect class="barre-g' + (i === 13 ? ' auj' : '') + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (larg * 0.64).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="2"><title>' + j.d.toLocaleDateString('fr-FR') + ' : ' + j.n + '</title></rect>';
      if (j.n) s += '<text class="val" x="' + (x + larg * 0.32).toFixed(1) + '" y="' + (y - 4).toFixed(1) + '" text-anchor="middle">' + j.n + '</text>';
      if (i % 2 === 1 || i === 13) s += '<text class="axe" x="' + (g + i * larg + larg / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i === 13 ? 'auj.' : j.d.getDate() + '/' + (j.d.getMonth() + 1)) + '</text>';
    });
    return s + '</svg>';
  }

  function pVeille(c) {
    var actifs = S.clients.filter(function (x) { return x.actif; }), susp = S.clients.length - actifs.length;
    var expires = S.clients.filter(function (x) { var j = joursRestants(x.abonnement_fin); return j !== null && j < 0 && x.actif; });
    var bientot = S.clients.filter(function (x) { var j = joursRestants(x.abonnement_fin); return j !== null && j >= 0 && j <= 15; });
    var dormants = actifs.filter(function (x) { return O.joursDepuis(x.derniere_actualite) > 30; });
    var acces = S.clients.filter(function (x) { return x.acces_support_actif; });
    var err24 = S.erreurs.filter(function (e) { return O.joursDepuis(e.created_at) < 1; }).length;
    var nouvelles = S.demandes.filter(function (d) { return d.statut === 'nouvelle'; }).length;
    var mrr = actifs.reduce(function (t, x) { var p = { essentiel: 5000, organisation: 10000, reseau: 20000 }[x.plan] || 0; return t + p; }, 0);

    var surv = [];
    expires.forEach(function (x) { surv.push(['alerte', '<b>' + esc(x.nom) + '</b> : abonnement expiré depuis ' + Math.abs(joursRestants(x.abonnement_fin)) + ' j', 'Relancer le paiement ou suspendre depuis Clients.']); });
    bientot.forEach(function (x) { surv.push(['horloge', '<b>' + esc(x.nom) + '</b> : abonnement se termine dans ' + joursRestants(x.abonnement_fin) + ' j', 'Prévenir le client par WhatsApp.']); });
    acces.forEach(function (x) { surv.push(['cle', '<b>' + esc(x.nom) + '</b> vous a ouvert l’accès' + (x.acces_support_corrections ? ' (corrections)' : ' (lecture)'), 'Jusqu’au ' + O.heureLongue(x.acces_support_expire) + '.']); });
    dormants.forEach(function (x) { surv.push(['actu', '<b>' + esc(x.nom) + '</b> n’a rien publié depuis ' + (x.derniere_actualite ? O.quand(x.derniere_actualite).replace('il y a ', '') : 'toujours'), 'Un site qui ne vit pas risque de ne pas être renouvelé.']); });

    c.innerHTML = '<div class="tete"><div><h1>Veille technique</h1><p>État du service MinVa, ' + O.dateLongue(new Date()) + '.</p></div></div>' +
      '<div class="kpis">' +
      '<a class="kpi bon" href="#clients"><b>' + actifs.length + '</b><span>clients actifs' + (susp ? ' · ' + susp + ' suspendu' + (susp > 1 ? 's' : '') : '') + '</span></a>' +
      '<a class="kpi' + (expires.length ? ' alerte' : bientot.length ? ' attention' : '') + '" href="#clients"><b>' + expires.length + ' / ' + bientot.length + '</b><span>abonnements expirés / à renouveler sous 15 j</span></a>' +
      '<a class="kpi' + (nouvelles ? ' attention' : '') + '" href="#demandes"><b>' + nouvelles + '</b><span>nouvelles demandes d’abonnement</span></a>' +
      '<a class="kpi' + (S.docs.length ? ' attention' : '') + '" href="#documents"><b>' + S.docs.length + '</b><span>documents à vérifier</span></a>' +
      '<a class="kpi' + (err24 ? ' alerte' : ' bon') + '" href="#erreurs"><b>' + err24 + '</b><span>erreurs signalées (24 h)</span></a>' +
      '<div class="kpi"><b>' + S.activite.length + '</b><span>actualités publiées (14 j)</span></div>' +
      '<div class="kpi' + (acces.length ? ' attention' : '') + '"><b>' + acces.length + '</b><span>accès support ouverts</span></div>' +
      '<div class="kpi"><b>' + O.nb(mrr) + '</b><span>FCFA / mois attendus</span></div></div>' +
      '<div class="g2"><section class="bloc"><h2>Activité des clients · actualités publiées par jour</h2><div class="graph">' + graphique() + '</div></section>' +
      '<section class="bloc"><h2>Services</h2><ul class="services">' +
      '<li><span class="pt ' + (DV.mode === 'demo' ? 'att' : 'ok') + '"></span>Base de données' + '<code>' + (DV.mode === 'demo' ? 'mode démo (navigateur)' : esc(window.MINVA_DEV_CONFIG.SUPABASE_URL)) + '</code></li>' +
      '<li><span class="pt" id="pt-sb"></span>Supabase (statut mondial)<code><a href="https://status.supabase.com" target="_blank" rel="noopener">status.supabase.com</a></code></li>' +
      '<li><span class="pt" id="pt-gh"></span>GitHub Pages (hébergement)<code><a href="https://www.githubstatus.com" target="_blank" rel="noopener">githubstatus.com</a></code></li>' +
      '<li><span class="pt ok"></span>Sites clients en ligne<code>' + actifs.length + ' / ' + S.clients.length + '</code></li>' +
      '<li><span class="pt" id="pt-net"></span>Votre connexion<code id="c-net">…</code></li></ul></section></div>' +
      '<section class="bloc"><h2>À surveiller</h2>' + (surv.length ? '<ul class="surveiller">' + surv.map(function (s) { return '<li>' + ico(s[0]) + '<div>' + s[1] + '<small>' + esc(s[2]) + '</small></div></li>'; }).join('') + '</ul>' : '<p class="note">Rien à signaler. Tous les clients sont à jour.</p>') + '</section>';

    // Petites sondes en direct (statut public des services)
    var t0 = performance.now();
    fetch(location.href, { cache: 'no-store', method: 'HEAD' }).then(function () {
      var ms = Math.round(performance.now() - t0); document.getElementById('c-net').textContent = 'en ligne · ' + ms + ' ms';
      document.getElementById('pt-net').className = 'pt ' + (ms < 800 ? 'ok' : 'att');
    }).catch(function () { var e = document.getElementById('c-net'); if (e) { e.textContent = 'hors ligne'; document.getElementById('pt-net').className = 'pt ko'; } });
    [['pt-sb', 'https://status.supabase.com/api/v2/status.json'], ['pt-gh', 'https://www.githubstatus.com/api/v2/status.json']].forEach(function (s) {
      fetch(s[1], { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        var el = document.getElementById(s[0]); if (!el) return;
        var ind = j.status && j.status.indicator; el.className = 'pt ' + (ind === 'none' ? 'ok' : ind === 'minor' ? 'att' : 'ko'); el.title = j.status.description;
      }).catch(function () {});
    });
  }

  // =================================================================
  // CLIENTS
  // =================================================================
  function pClients(c) {
    var q = O.norm(S.filtre);
    var liste = S.clients.filter(function (x) {
      if (S.statut === 'actifs' && !x.actif) return false;
      if (S.statut === 'suspendus' && x.actif) return false;
      if (S.statut === 'acces' && !x.acces_support_actif) return false;
      if (S.statut === 'expires' && !(joursRestants(x.abonnement_fin) < 0)) return false;
      return !q || O.norm(x.nom + ' ' + x.slug + ' ' + x.ville).indexOf(q) >= 0;
    });
    c.innerHTML = '<div class="tete"><div><h1>Clients</h1><p>' + S.clients.length + ' organisations. Le contenu privé d’un client n’est visible que s’il vous a ouvert l’accès.</p></div>' +
      '<button type="button" class="btn btn-principal" id="nouveau">' + ico('plus') + 'Nouveau client</button></div>' +
      '<section class="bloc"><div class="outils"><input type="search" id="q" placeholder="Rechercher un client, une ville, une adresse…" value="' + esc(S.filtre) + '" aria-label="Rechercher">' +
      '<select id="st" aria-label="Filtrer"><option value="tous">Tous</option><option value="actifs">Actifs</option><option value="suspendus">Suspendus</option><option value="expires">Abonnement expiré</option><option value="acces">Accès support ouvert</option></select></div>' +
      '<div class="table-zone"><table class="t"><thead><tr><th>Organisation</th><th>Formule</th><th>Fin d’abonnement</th><th>Admins</th><th>Actualités</th><th>Statut</th><th>Accès support</th><th></th></tr></thead><tbody>' +
      (liste.length ? liste.map(function (x) {
        var j = joursRestants(x.abonnement_fin);
        var fin = x.abonnement_fin ? '<span class="' + (j < 0 ? 'expire' : j <= 15 ? 'bientot' : '') + '">' + new Date(x.abonnement_fin).toLocaleDateString('fr-FR') + (j < 0 ? ' · expiré' : j <= 15 ? ' · ' + j + ' j' : '') + '</span>' : '—';
        return '<tr class="' + (x.actif ? '' : 'suspendu') + '"><td class="nom"><b>' + esc(x.nom) + '</b><code>/' + esc(x.slug) + ' · ' + esc(x.ville || '') + '</code></td>' +
          '<td>' + esc(TARIFS[x.plan] || x.plan) + '</td><td class="num">' + fin + '</td><td class="num">' + x.nb_admins + '/3</td>' +
          '<td class="num">' + x.nb_actualites + (x.derniere_actualite ? ' · ' + O.quand(x.derniere_actualite) : '') + '</td>' +
          '<td>' + (x.actif ? (x.statut_verification === 'verifie' ? '<span class="badge b-verifie">' + ico('verifie') + 'Vérifié</span>' : '<span class="badge b-en-cours">En ligne</span>') : '<span class="badge b-neutre">Suspendu</span>') + '</td>' +
          '<td>' + (x.acces_support_actif ? '<span class="acces-ouvert">' + ico('cle') + (x.acces_support_corrections ? 'corrections' : 'lecture') + '</span>' : '<span class="note">fermé</span>') + '</td>' +
          '<td><div class="actions"><a class="btn btn-secondaire btn-sm" href="' + esc(DV.lienSite(x.slug)) + '" target="_blank" rel="noopener" title="Ouvrir le site public">' + ico('oeil') + '</a>' +
          '<button type="button" class="btn btn-sm ' + (x.acces_support_actif ? 'btn-noir' : 'btn-secondaire') + '" data-insp="' + x.id + '"' + (x.acces_support_actif ? '' : ' disabled title="Le client n’a pas ouvert l’accès"') + '>' + ico('code') + 'Dépanner</button>' +
          '<button type="button" class="btn btn-secondaire btn-sm" data-gerer="' + x.id + '">Gérer</button></div></td></tr>';
      }).join('') : '<tr><td colspan="8"><p class="note">Aucun client ne correspond.</p></td></tr>') + '</tbody></table></div></section>';
    document.getElementById('st').value = S.statut;
    document.getElementById('q').oninput = function (e) { S.filtre = e.target.value; var pos = e.target.selectionStart; pClients(c); var q2 = document.getElementById('q'); q2.focus(); q2.setSelectionRange(pos, pos); };
    document.getElementById('st').onchange = function (e) { S.statut = e.target.value; pClients(c); };
    document.getElementById('nouveau').onclick = function () { formClient({}); };
    c.querySelector('tbody').onclick = function (e) {
      var i = e.target.closest('[data-insp]'); if (i) { S.inspection = { id: i.dataset.insp }; location.hash = 'inspection'; return; }
      var g = e.target.closest('[data-gerer]'); if (g) gerer(S.clients.find(function (x) { return x.id === g.dataset.gerer; }));
    };
  }

  function mdpAleatoire() { var car = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789', m = '', a = new Uint32Array(10); crypto.getRandomValues(a); a.forEach(function (n) { m += car[n % car.length]; }); return m; }
  function dansUnAn() { var d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); }

  function formClient(pre) {
    fenetre('Nouveau client',
      '<div class="champ"><label for="n-nom">Nom de l’organisation</label><input id="n-nom" type="text" autocomplete="off" value="' + esc(pre.nom || '') + '"></div>' +
      '<div class="grille-champs"><div class="champ"><label for="n-sect">Secteur</label><select id="n-sect">' + Object.keys(O.SECTEURS).map(function (k) { return '<option value="' + k + '"' + (pre.secteur === k ? ' selected' : '') + '>' + O.SECTEURS[k].nom + '</option>'; }).join('') + '</select></div>' +
      '<div class="champ"><label for="n-ville">Ville</label><input id="n-ville" type="text" autocomplete="off" value="' + esc(pre.ville || '') + '"></div></div>' +
      '<div class="champ" style="padding:12px 14px;background:var(--fond-neutre);border-radius:6px"><span class="etiquette">Adresse du site, attribuée automatiquement</span><b id="n-apercu" style="word-break:break-all"></b><span class="aide" id="n-regle">D’après le nom de l’organisation.</span></div>' +
      '<div class="grille-champs"><div class="champ"><label for="n-plan">Formule</label><select id="n-plan">' + Object.keys(TARIFS).map(function (k) { return '<option value="' + k + '"' + ((pre.plan || 'essentiel') === k ? ' selected' : '') + '>' + TARIFS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="champ"><label for="n-fin">Payé jusqu’au</label><input id="n-fin" type="date" value="' + dansUnAn() + '"></div></div>' +
      '<hr style="border:0;border-top:1px solid var(--gris-filet);margin:4px 0"><b>Premier administrateur</b>' +
      '<div class="grille-champs"><div class="champ"><label for="n-anom">Nom</label><input id="n-anom" type="text" autocomplete="off" value="' + esc(pre.responsable || '') + '"></div><div class="champ"><label for="n-aemail">Email</label><input id="n-aemail" type="email" autocomplete="off" value="' + esc(pre.email || '') + '"></div></div>' +
      '<div class="champ"><label for="n-amdp">Mot de passe provisoire</label><input id="n-amdp" type="text" value="' + mdpAleatoire() + '"><span class="aide">À transmettre au client par téléphone. Il pourra le changer.</span></div>',
      '<button type="button" class="btn btn-secondaire" id="n-annuler">Annuler</button><button type="button" class="btn btn-principal" id="n-ok">Créer le client</button>');
    // L'adresse du site est attribuée automatiquement (nom, puis nom + ville, puis numéro) :
    // aucune case à remplir, donc rien que Chrome puisse modifier par erreur.
    var nom = document.getElementById('n-nom'), ville = document.getElementById('n-ville'), ap = document.getElementById('n-apercu');
    var pris = S.clients.map(function (x) { return x.slug; });
    function slugActuel() { return O.attribuerSlug(nom.value, ville.value, pris); }
    function maj() {
      var sl = slugActuel(), base = O.slugifier(nom.value);
      ap.textContent = sl ? DV.lienSite(sl) : 'Tapez le nom de l’organisation';
      document.getElementById('n-regle').textContent = !sl ? '' : sl === base ? 'D’après le nom de l’organisation.' : 'Le nom seul est déjà pris : la ville ou un numéro a été ajouté.';
    }
    nom.oninput = maj; ville.oninput = maj; ville.onchange = maj;
    maj();
    document.getElementById('n-annuler').onclick = function () { fen.close(); };
    document.getElementById('n-ok').onclick = function () {
      var b = this; occupe(b, true, 'Création…');
      var donnees = { nom: nom.value.trim(), slug: slugActuel(), sigle: O.sigleDe(nom.value), secteur: document.getElementById('n-sect').value, ville: document.getElementById('n-ville').value.trim(),
        plan: document.getElementById('n-plan').value, abonnementFin: document.getElementById('n-fin').value,
        admin: { nom: document.getElementById('n-anom').value.trim(), email: document.getElementById('n-aemail').value.trim(), motDePasse: document.getElementById('n-amdp').value } };
      DV.creerClient(donnees).then(function () {
        if (pre.demandeId) return DV.majDemande(pre.demandeId, 'convertie');
      }).then(rafraichir).then(function () {
        fen.close(); location.hash = 'clients';
        O.toast('Client créé : ' + donnees.nom + '. Transmettez l’email et le mot de passe à ' + donnees.admin.nom + '.');
      }).catch(function (e) { occupe(b, false); erreur(e); });
    };
  }

  function gerer(x) {
    fenetre(x.nom,
      '<dl class="kv"><dt>Adresse</dt><dd><a href="' + esc(DV.lienSite(x.slug)) + '" target="_blank" rel="noopener">' + esc(DV.lienSite(x.slug)) + '</a></dd><dt>Créé</dt><dd>' + O.dateLongue(x.created_at) + '</dd><dt>Admins</dt><dd>' + x.nb_admins + '/3</dd></dl>' +
      '<div class="grille-champs"><div class="champ"><label for="g-plan">Formule</label><select id="g-plan">' + Object.keys(TARIFS).map(function (k) { return '<option value="' + k + '"' + (x.plan === k ? ' selected' : '') + '>' + TARIFS[k] + '</option>'; }).join('') + '</select></div>' +
      '<div class="champ"><label for="g-fin">Payé jusqu’au</label><input id="g-fin" type="date" value="' + (x.abonnement_fin || '') + '"></div></div>' +
      '<label class="case"><input type="checkbox" id="g-verif"' + (x.statut_verification === 'verifie' ? ' checked' : '') + '> Badge « Vérifié par MinVa »</label>' +
      '<div class="pile" style="border-top:1px solid var(--gris-filet);padding-top:16px"><b>' + (x.actif ? 'Suspendre le site' : 'Réactiver le site') + '</b><p class="note">' + (x.actif ? 'Le site public et la console du client deviennent inaccessibles. Aucune donnée n’est effacée.' : 'Le site et la console redeviennent accessibles immédiatement.') + '</p>' +
      '<button type="button" class="btn ' + (x.actif ? 'btn-danger' : 'btn-noir') + '" id="g-actif" style="align-self:flex-start">' + (x.actif ? 'Suspendre' : 'Réactiver') + '</button></div>' +
      '<div class="pile" style="border-top:1px solid var(--gris-filet);padding-top:16px"><b>Supprimer définitivement</b><p class="note">Efface le site, les actualités, les documents et les comptes des administrateurs. Impossible à annuler. Tapez <code>' + esc(x.slug) + '</code> pour confirmer.</p>' +
      '<div class="mdp-ligne" style="display:flex;gap:8px"><input type="text" id="g-conf" aria-label="Confirmation" style="flex:1;min-width:0;font:inherit;padding:8px 12px;border:1px solid var(--gris-pierre);border-radius:4px"><button type="button" class="btn btn-danger" id="g-suppr" disabled>Supprimer</button></div></div>',
      '<button type="button" class="btn btn-secondaire" id="g-annuler">Fermer</button><button type="button" class="btn btn-principal" id="g-ok">Enregistrer</button>');
    document.getElementById('g-annuler').onclick = function () { fen.close(); };
    document.getElementById('g-ok').onclick = function () {
      var b = this; occupe(b, true);
      DV.majClient(x.id, { plan: document.getElementById('g-plan').value, fin: document.getElementById('g-fin').value || null, verif: document.getElementById('g-verif').checked ? 'verifie' : 'en-cours' })
        .then(rafraichir).then(function () { fen.close(); O.toast('Client mis à jour.'); }).catch(function (e) { occupe(b, false); erreur(e); });
    };
    document.getElementById('g-actif').onclick = function () {
      var b = this; occupe(b, true);
      DV.majClient(x.id, { actif: !x.actif }).then(rafraichir).then(function () { fen.close(); O.toast(x.actif ? 'Site suspendu.' : 'Site réactivé.'); }).catch(function (e) { occupe(b, false); erreur(e); });
    };
    var conf = document.getElementById('g-conf'), sup = document.getElementById('g-suppr');
    conf.oninput = function () { sup.disabled = conf.value.trim() !== x.slug; };
    sup.onclick = function () {
      occupe(sup, true, 'Suppression…');
      DV.supprimerClient(x.id).then(rafraichir).then(function () { fen.close(); O.toast('Client supprimé définitivement.'); }).catch(function (e) { occupe(sup, false); erreur(e); });
    };
  }

  // =================================================================
  // INSPECTION (dépannage avec l'accord du client)
  // =================================================================
  function pInspection(c) {
    if (!S.inspection) { location.hash = 'clients'; return; }
    c.innerHTML = '<p class="note">Ouverture du compte client…</p>';
    DV.inspecter(S.inspection.id).then(function (d) {
      var o = d.org, corr = d.corrections;
      c.innerHTML = '<div class="inspection-bandeau">' + ico('cle', 'ico-lg') + '<span>Dépannage de <b>' + esc(o.nom) + '</b></span><span class="badge ' + (corr ? 'corr' : '') + '">' + (corr ? 'Corrections autorisées' : 'Lecture seule') + '</span>' +
        '<span class="note" style="color:rgba(251,247,240,.75)">Accès jusqu’au ' + esc(O.heureLongue(o.acces_support_expire)) + '. Tout est inscrit dans le journal du client.</span>' +
        '<a class="btn btn-secondaire btn-sm" href="#clients">' + ico('retour') + 'Retour</a></div>' +
        '<div class="g2"><div>' +
        '<section class="bloc"><h2>Fiche</h2>' + (corr
          ? '<div class="pile"><div class="champ"><label for="i-slogan">Slogan</label><input id="i-slogan" type="text" value="' + esc(o.slogan) + '"></div><div class="champ"><label for="i-mission">Mission</label><textarea id="i-mission">' + esc(o.mission) + '</textarea></div><div class="champ"><label for="i-apropos">À propos</label><textarea id="i-apropos">' + esc(o.apropos) + '</textarea></div>' +
            '<button type="button" class="btn btn-noir" id="i-enreg" style="align-self:flex-start">Enregistrer la correction</button></div>'
          : '<dl class="kv"><dt>Slogan</dt><dd>' + esc(o.slogan || '—') + '</dd><dt>Mission</dt><dd>' + esc(o.mission || '—') + '</dd><dt>Thème</dt><dd>' + esc(o.theme) + '</dd><dt>Rubriques</dt><dd><code>' + esc(JSON.stringify(o.rubriques)) + '</code></dd><dt>Contact</dt><dd><code>' + esc(JSON.stringify(o.contact)) + '</code></dd><dt>Logo</dt><dd>' + (o.logo_url ? 'oui' : 'non') + '</dd><dt>Couverture</dt><dd>' + (o.couverture_url ? 'oui' : 'non') + '</dd></dl>') + '</section>' +
        '<section class="bloc"><h2>Actualités · ' + d.actualites.length + '</h2><ul class="mini" id="i-actus">' + d.actualites.map(function (a) {
          return '<li><div>' + esc(String(a.texte).slice(0, 140)) + (a.texte.length > 140 ? '…' : '') + '<small>' + (O.TYPES_ACTU[a.type] || '') + ' · ' + O.quand(a.created_at) + ' · ' + (a.photos || []).length + ' photo(s)</small></div>' +
            (corr ? '<button type="button" class="btn btn-lien" data-sa="' + a.id + '">Supprimer</button>' : '') + '</li>';
        }).join('') + '</ul></section></div><div>' +
        '<section class="bloc"><h2>Administrateurs</h2><ul class="mini">' + d.admins.map(function (a) { return '<li><div>' + esc(a.nom) + '<small>' + esc(a.email) + '</small></div></li>'; }).join('') + '</ul></section>' +
        '<section class="bloc"><h2>Données techniques</h2><dl class="kv"><dt>id</dt><dd><code>' + esc(o.id) + '</code></dd><dt>Projets</dt><dd>' + d.projets.length + '</dd><dt>Documents</dt><dd>' + d.documents.map(function (x) { return x.type + ':' + x.statut; }).join(', ') + '</dd></dl></section>' +
        '<section class="bloc"><h2>Journal du client</h2><ul class="mini">' + d.journal.slice(0, 8).map(function (j) { return '<li><div>' + esc(j.details) + '<small>' + esc(O.heureLongue(j.created_at)) + '</small></div></li>'; }).join('') + '</ul></section></div></div>';
      var e = document.getElementById('i-enreg');
      if (e) e.onclick = function () {
        occupe(e, true);
        DV.corriger(o.id, { slogan: document.getElementById('i-slogan').value, mission: document.getElementById('i-mission').value, apropos: document.getElementById('i-apropos').value })
          .then(function () { O.toast('Correction enregistrée et inscrite au journal du client.'); pInspection(c); }).catch(function (er) { occupe(e, false); erreur(er); });
      };
      var l = document.getElementById('i-actus');
      l.onclick = function (ev) {
        var b = ev.target.closest('[data-sa]'); if (!b) return;
        if (b.dataset.ok !== '1') { b.dataset.ok = '1'; b.textContent = 'Confirmer'; return; }
        DV.supprimerActu(o.id, b.dataset.sa).then(function () { O.toast('Actualité supprimée (inscrit au journal).'); pInspection(c); }).catch(erreur);
      };
    }).catch(function (e) {
      c.innerHTML = '<div class="bloc"><h2>Accès refusé</h2><p>' + esc(e.message) + '</p><p class="note">Demandez au client d’ouvrir l’accès depuis sa console : menu « Accès développeur ».</p><a class="btn btn-noir" href="#clients">Retour aux clients</a></div>';
    });
  }

  // =================================================================
  // DEMANDES D'ABONNEMENT (depuis le site vitrine)
  // =================================================================
  function pDemandes(c) {
    var ST = { nouvelle: 'Nouvelle', contactee: 'Contactée', convertie: 'Client créé', refusee: 'Sans suite' };
    c.innerHTML = '<div class="tete"><div><h1>Demandes d’abonnement</h1><p>Envoyées depuis le formulaire du site vitrine. Appelez, encaissez par Mobile Money, puis créez le client.</p></div></div><section class="bloc" id="dl">' +
      (S.demandes.length ? S.demandes.map(function (d) {
        var wa = String(d.telephone || '').replace(/[^0-9]/g, '');
        return '<article class="demande"><h3>' + esc(d.nom_organisation) + ' <span class="badge ' + (d.statut === 'nouvelle' ? 'b-avant' : 'b-neutre') + '">' + ST[d.statut] + '</span></h3>' +
          '<p>' + esc(d.responsable) + ' · <span class="num">' + esc(d.telephone) + '</span>' + (d.email ? ' · ' + esc(d.email) : '') + '</p>' +
          '<p class="meta">' + esc([O.SECTEURS[d.secteur] ? O.SECTEURS[d.secteur].nom : '', d.ville, TARIFS[d.plan]].filter(Boolean).join(' · ')) + ' · reçue ' + O.quand(d.created_at) + '</p>' +
          (d.message ? '<p>« ' + esc(d.message) + ' »</p>' : '') +
          '<div class="actions">' + (wa ? '<a class="btn btn-secondaire btn-sm" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Bonjour ' + d.responsable + ', ici MinVa. Merci pour votre demande pour ' + d.nom_organisation + '.') + '" target="_blank" rel="noopener">' + ico('whatsapp') + 'WhatsApp</a>' : '') +
          (d.statut !== 'convertie' ? '<button type="button" class="btn btn-principal btn-sm" data-conv="' + d.id + '">Créer le client</button>' : '') +
          '<select data-st="' + d.id + '" aria-label="Statut de la demande">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (d.statut === k ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select></div></article>';
      }).join('') : '<p class="note">Aucune demande pour l’instant.</p>') + '</section>';
    var z = document.getElementById('dl');
    z.onchange = function (e) { var s = e.target.closest('[data-st]'); if (s) DV.majDemande(s.dataset.st, s.value).then(rafraichir).then(function () { O.toast('Statut mis à jour.'); }).catch(erreur); };
    z.onclick = function (e) {
      var b = e.target.closest('[data-conv]'); if (!b) return;
      var d = S.demandes.find(function (x) { return x.id === b.dataset.conv; });
      formClient({ nom: d.nom_organisation, secteur: d.secteur, ville: d.ville, plan: d.plan, responsable: d.responsable, email: d.email, demandeId: d.id });
    };
  }

  // =================================================================
  // DOCUMENTS À VÉRIFIER
  // =================================================================
  function pDocs(c) {
    var NOMS = {}; O.DOCS.forEach(function (d) { NOMS[d[0]] = d[1]; });
    c.innerHTML = '<div class="tete"><div><h1>Documents à vérifier</h1><p>Contrôlez que le document est lisible, au bon nom, et à jour. Le public ne voit jamais le fichier, seulement « Vérifié ».</p></div></div><section class="bloc" id="dz">' +
      (S.docs.length ? S.docs.map(function (d) {
        return '<div class="doc"><div><b>' + esc(NOMS[d.type] || d.type) + (d.annee ? ' · ' + d.annee : '') + '</b><small>' + esc(d.org_nom) + ' · envoyé ' + O.quand(d.created_at) + '</small></div>' +
          '<div class="actions"><button type="button" class="btn btn-secondaire btn-sm" data-voir="' + esc(d.chemin || '') + '">' + ico('oeil') + 'Ouvrir</button>' +
          '<button type="button" class="btn btn-noir btn-sm" data-ok="' + d.id + '">' + ico('verifie') + 'Valider</button><button type="button" class="btn btn-danger btn-sm" data-ko="' + d.id + '">Refuser</button></div></div>';
      }).join('') : '<p class="note">Aucun document en attente.</p>') + '</section>';
    document.getElementById('dz').onclick = function (e) {
      var v = e.target.closest('[data-voir]');
      if (v) { DV.lienDocument(v.dataset.voir).then(function (u) { if (u) window.open(u, '_blank', 'noopener'); else O.toast('En mode démo, il n’y a pas de vrai fichier à ouvrir.'); }).catch(erreur); return; }
      var ok = e.target.closest('[data-ok]');
      if (ok) { occupe(ok, true); DV.verifierDoc(ok.dataset.ok, 'verifie').then(rafraichir).then(function () { O.toast('Document validé.'); }).catch(erreur); return; }
      var ko = e.target.closest('[data-ko]');
      if (ko) {
        fenetre('Refuser le document', '<div class="champ"><label for="motif">Motif (le client le verra)</label><input id="motif" type="text" placeholder="Illisible, document d’une autre organisation, pas signé…"></div>',
          '<button type="button" class="btn btn-secondaire" id="m-an">Annuler</button><button type="button" class="btn btn-danger" id="m-ok">Refuser</button>');
        document.getElementById('m-an').onclick = function () { fen.close(); };
        document.getElementById('m-ok').onclick = function () { DV.verifierDoc(ko.dataset.ko, 'refuse', document.getElementById('motif').value).then(rafraichir).then(function () { fen.close(); O.toast('Document refusé. Le client est invité à en envoyer un autre.'); }).catch(erreur); };
      }
    };
  }

  // =================================================================
  // ERREURS
  // =================================================================
  function pErreurs(c) {
    var noms = {}; S.clients.forEach(function (x) { noms[x.id] = x.nom; });
    c.innerHTML = '<div class="tete"><div><h1>Erreurs signalées</h1><p>Remontées automatiquement par les navigateurs des visiteurs et des clients (100 dernières).</p></div></div><section class="bloc"><div class="table-zone"><table class="t err"><thead><tr><th>Quand</th><th>Application</th><th>Client</th><th>Page</th><th>Message</th></tr></thead><tbody>' +
      (S.erreurs.length ? S.erreurs.map(function (e) {
        return '<tr><td>' + esc(new Date(e.created_at).toLocaleString('fr-FR')) + '</td><td>' + esc(e.application) + '</td><td>' + esc(noms[e.org_id] || '—') + '</td><td>' + esc(e.page) + '</td><td class="msg">' + esc(e.message) + '</td></tr>';
      }).join('') : '<tr><td colspan="5"><p class="note">Aucune erreur. Tout fonctionne.</p></td></tr>') + '</tbody></table></div></section>';
  }

  window.addEventListener('error', function (e) { console.error(e.message); });
  DV.auth.profil().then(function (p) { if (p) return demarrer(); connexion(); }).catch(function (e) { connexion(e.message); });
})();
