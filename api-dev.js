// =====================================================================
// MinVa — Console Développeur : accès aux données
// Réservé au rôle « developpeur ». Le contenu privé d'un client n'est
// accessible QUE si ce client a ouvert l'accès (vérifié par la base).
// =====================================================================
(function () {
  var C = window.MINVA_DEV_CONFIG || {};
  var REEL = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  var DV = { mode: REEL ? 'reel' : 'demo' };
  DV.lienSite = function (slug) { return new URL((C.URL_MINVA || '../minva/').replace(/\/?$/, '/') + slug, location.href).href; };

  if (!REEL) {
    var D = window.MINVA_DEMO, CLE = 'minva-demo-session-dev';
    var att = function (v) { return new Promise(function (ok) { setTimeout(function () { ok(v); }, 100); }); };
    var ko = function (m) { return Promise.reject(new Error(m)); };
    var estDev = function (db) { var id = localStorage.getItem(CLE); return db.profils.some(function (p) { return p.id === id && p.role === 'developpeur'; }); };
    var garde = function () { var db = D.lire(); if (!estDev(db)) throw new Error('Réservé au développeur'); return db; };
    var jour = function (db, org, action, details) { db.journal_support.push({ id: D.uid(), org_id: org, action: action, details: details, created_at: new Date().toISOString() }); };

    DV.auth = {
      connexion: function (email, mdp) {
        var db = D.lire(), p = db.profils.find(function (x) { return x.email === String(email).trim().toLowerCase() && x.mdp === mdp && x.role === 'developpeur'; });
        if (!p) return ko('Identifiants incorrects, ou ce compte n’est pas un compte développeur.');
        localStorage.setItem(CLE, p.id); return att({ nom: p.nom, email: p.email });
      },
      deconnexion: function () { localStorage.removeItem(CLE); return att(true); },
      profil: function () { var db = D.lire(), id = localStorage.getItem(CLE), p = db.profils.find(function (x) { return x.id === id && x.role === 'developpeur'; }); return att(p ? { nom: p.nom, email: p.email } : null); }
    };

    DV.clients = function () {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      return att(db.organisations.map(function (o) {
        var actus = db.actualites.filter(function (a) { return a.org_id === o.id; });
        return { id: o.id, slug: o.slug, nom: o.nom, secteur: o.secteur, ville: o.ville, plan: o.plan, abonnement_fin: o.abonnement_fin, actif: o.actif, statut_verification: o.statut_verification,
          acces_support_actif: D.devAAcces(o), acces_support_corrections: o.acces_support_corrections, acces_support_expire: o.acces_support_expire, created_at: o.created_at,
          nb_admins: db.profils.filter(function (p) { return p.org_id === o.id; }).length, nb_actualites: actus.length,
          derniere_actualite: actus.map(function (a) { return a.created_at; }).sort().pop() || null,
          docs_a_verifier: db.documents.filter(function (d) { return d.org_id === o.id && d.statut === 'envoye'; }).length };
      }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }));
    };
    DV.creerClient = function (b) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      if (!b.nom || !b.slug || !b.admin || !b.admin.nom || !b.admin.email || !b.admin.motDePasse) return ko('Champs manquants');
      if (!/^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$/.test(b.slug)) return ko('Lien invalide');
      if (db.organisations.some(function (o) { return o.slug === b.slug; })) return ko('Ce lien de site est déjà pris');
      if (db.profils.some(function (p) { return p.email.toLowerCase() === b.admin.email.toLowerCase(); })) return ko('Cet email a déjà un compte MinVa');
      if (String(b.admin.motDePasse).length < 8) return ko('Mot de passe : 8 caractères minimum');
      var id = D.uid();
      db.organisations.push({ id: id, slug: b.slug, nom: b.nom, sigle: b.sigle || '', secteur: b.secteur, ville: b.ville || '', region: b.region || '', annee_creation: null, slogan: '', mission: '', apropos: '', zone: '', langues: '',
        beneficiaires: 0, beneficiaires_label: 'bénéficiaires', membres: 0, theme: b.theme || 'nuit', logo_url: null, couverture_url: null,
        rubriques: { apropos: true, actualites: true, projets: true, besoins: true, galerie: true, documents: true, equipe: true, contact: true }, besoins: [], equipe: [], contact: {},
        dans_annuaire: true, actif: true, statut_verification: 'en-cours', plan: b.plan || 'essentiel', abonnement_fin: b.abonnementFin || null,
        acces_support_actif: false, acces_support_corrections: false, acces_support_expire: null, created_at: new Date().toISOString() });
      db.profils.push({ id: D.uid(), org_id: id, role: 'admin', nom: b.admin.nom, email: b.admin.email.toLowerCase(), mdp: b.admin.motDePasse, created_at: new Date().toISOString() });
      D.ecrire(db); return att(true);
    };
    DV.majClient = function (id, p) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      var o = db.organisations.find(function (x) { return x.id === id; });
      if (p.actif != null) o.actif = p.actif; if (p.plan) o.plan = p.plan; if (p.fin) o.abonnement_fin = p.fin; if (p.verif) o.statut_verification = p.verif;
      D.ecrire(db); return att(true);
    };
    DV.supprimerClient = function (id) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      ['actualites', 'projets', 'documents', 'journal_support', 'profils'].forEach(function (t) { db[t] = db[t].filter(function (x) { return x.org_id !== id; }); });
      db.organisations = db.organisations.filter(function (o) { return o.id !== id; });
      D.ecrire(db); return att(true);
    };
    DV.inspecter = function (id) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      var o = db.organisations.find(function (x) { return x.id === id; });
      if (!D.devAAcces(o)) return ko('Ce client n’a pas ouvert l’accès développeur.');
      jour(db, id, 'consultation', 'Le développeur a consulté votre compte pour un dépannage.'); D.ecrire(db);
      return att({ org: Object.assign({}, o), corrections: D.devAAcces(o, true),
        admins: db.profils.filter(function (p) { return p.org_id === id; }).map(function (p) { return { nom: p.nom, email: p.email }; }),
        actualites: db.actualites.filter(function (a) { return a.org_id === id; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }),
        projets: db.projets.filter(function (p) { return p.org_id === id; }), documents: db.documents.filter(function (d) { return d.org_id === id; }),
        journal: db.journal_support.filter(function (j) { return j.org_id === id; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }) });
    };
    DV.corriger = function (id, patch) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      var o = db.organisations.find(function (x) { return x.id === id; });
      if (!D.devAAcces(o, true)) return ko('Ce client n’a pas autorisé les corrections.');
      Object.assign(o, patch); jour(db, id, 'modification', 'Le développeur a modifié la fiche de l’organisation.'); D.ecrire(db); return att(true);
    };
    DV.supprimerActu = function (orgId, actuId) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      var o = db.organisations.find(function (x) { return x.id === orgId; });
      if (!D.devAAcces(o, true)) return ko('Ce client n’a pas autorisé les corrections.');
      db.actualites = db.actualites.filter(function (a) { return a.id !== actuId; }); jour(db, orgId, 'suppression', 'Le développeur a supprimé une actualité.'); D.ecrire(db); return att(true);
    };
    DV.demandes = function () { try { var db = garde(); } catch (e) { return ko(e.message); } return att(db.demandes_abonnement.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })); };
    DV.majDemande = function (id, statut) { var db = garde(); db.demandes_abonnement.find(function (d) { return d.id === id; }).statut = statut; D.ecrire(db); return att(true); };
    DV.docsAVerifier = function () {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      return att(db.documents.filter(function (d) { return d.statut === 'envoye'; }).map(function (d) { var o = db.organisations.find(function (x) { return x.id === d.org_id; }); return Object.assign({ org_nom: o ? o.nom : '?' }, d); }));
    };
    DV.lienDocument = function () { return Promise.resolve(null); };
    DV.verifierDoc = function (id, statut, commentaire) { var db = garde(); var d = db.documents.find(function (x) { return x.id === id; }); d.statut = statut; d.commentaire = commentaire || ''; D.ecrire(db); return att(true); };
    DV.erreurs = function () { try { var db = garde(); } catch (e) { return ko(e.message); } return att(db.erreurs_client.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })); };
    DV.activite = function (jours) {
      try { var db = garde(); } catch (e) { return ko(e.message); }
      var depuis = Date.now() - jours * 86400000;
      return att(db.actualites.filter(function (a) { return new Date(a.created_at).getTime() >= depuis; }).map(function (a) { return a.created_at; }));
    };
    DV.reinitialiserDemo = function () { D.reinitialiser(); localStorage.removeItem(CLE); localStorage.removeItem('minva-demo-session-admin'); };
    window.DV = DV;
    return;
  }

  // ---------------- MODE RÉEL ----------------
  var sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { storageKey: 'minva-dev-auth' } });
  function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }
  async function fonction(nom, corps) {
    var r = await sb.functions.invoke(nom, { body: corps });
    if (r.error) { var m = r.error.message; try { var b = await r.error.context.json(); if (b && b.erreur) m = b.erreur; } catch (e) {} throw new Error(m); }
    if (r.data && r.data.ok === false) throw new Error(r.data.erreur);
    return r.data;
  }
  async function moi() {
    var s = (await sb.auth.getSession()).data.session; if (!s) return null;
    var p = ok(await sb.from('profils').select('nom, email, role').eq('id', s.user.id).maybeSingle());
    return p && p.role === 'developpeur' ? p : null;
  }
  DV.auth = {
    connexion: async function (email, mdp) {
      var r = await sb.auth.signInWithPassword({ email: String(email).trim(), password: mdp });
      if (r.error) throw new Error('Identifiants incorrects.');
      var p = await moi(); if (!p) { await sb.auth.signOut(); throw new Error('Ce compte n’est pas un compte développeur.'); }
      return p;
    },
    deconnexion: async function () { await sb.auth.signOut(); return true; },
    profil: moi
  };
  DV.clients = async function () { return ok(await sb.rpc('dev_liste_organisations')); };
  DV.creerClient = function (b) { return fonction('creer-organisation', b); };
  DV.majClient = async function (id, p) { ok(await sb.rpc('dev_maj_organisation', { p_org: id, p_actif: p.actif == null ? null : p.actif, p_plan: p.plan || null, p_fin: p.fin || null, p_verif: p.verif || null })); return true; };
  DV.supprimerClient = function (id) { return fonction('supprimer-organisation', { orgId: id }); };
  DV.inspecter = async function (id) {
    ok(await sb.rpc('dev_journaliser_consultation', { p_org: id }));
    var r = await Promise.all([
      sb.from('organisations').select('*').eq('id', id).single(),
      sb.from('profils').select('nom, email').eq('org_id', id),
      sb.from('actualites').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(50),
      sb.from('projets').select('*').eq('org_id', id),
      sb.from('documents').select('*').eq('org_id', id),
      sb.from('journal_support').select('*').eq('org_id', id).order('created_at', { ascending: false }).limit(30)
    ]);
    var o = ok(r[0]);
    return { org: o, corrections: !!(o.acces_support_corrections && new Date(o.acces_support_expire) > new Date()), admins: ok(r[1]), actualites: ok(r[2]), projets: ok(r[3]), documents: ok(r[4]), journal: ok(r[5]) };
  };
  DV.corriger = async function (id, patch) { ok(await sb.from('organisations').update(patch).eq('id', id)); return true; };
  DV.supprimerActu = async function (orgId, actuId) { ok(await sb.from('actualites').delete().eq('id', actuId)); return true; };
  DV.demandes = async function () { return ok(await sb.from('demandes_abonnement').select('*').order('created_at', { ascending: false }).limit(200)); };
  DV.majDemande = async function (id, statut) { ok(await sb.from('demandes_abonnement').update({ statut: statut }).eq('id', id)); return true; };
  DV.docsAVerifier = async function () {
    var d = ok(await sb.from('documents').select('*, organisations(nom)').eq('statut', 'envoye').order('created_at'));
    return d.map(function (x) { return Object.assign({ org_nom: x.organisations ? x.organisations.nom : '?' }, x); });
  };
  DV.lienDocument = async function (chemin) { if (!chemin) return null; var r = ok(await sb.storage.from('documents').createSignedUrl(chemin, 600)); return r.signedUrl; };
  DV.verifierDoc = async function (id, statut, commentaire) { ok(await sb.rpc('dev_verifier_document', { p_doc: id, p_statut: statut, p_commentaire: commentaire || '' })); return true; };
  DV.erreurs = async function () { return ok(await sb.from('erreurs_client').select('*').order('created_at', { ascending: false }).limit(100)); };
  DV.activite = async function (jours) {
    var depuis = new Date(Date.now() - jours * 86400000).toISOString();
    return ok(await sb.from('actualites').select('created_at').gte('created_at', depuis).limit(5000)).map(function (a) { return a.created_at; });
  };
  window.DV = DV;
})();
