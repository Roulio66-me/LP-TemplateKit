/* app.js - gestion des templates avec Firebase Firestore */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, where, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

// Votre configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4mOy5q1T4wZ2xaB8s1OjU3JDsimMKDVQ",
  authDomain: "templatekit-23386.firebaseapp.com",
  projectId: "templatekit-23386",
  storageBucket: "templatekit-23386.firebasestorage.app",
  messagingSenderId: "9974063516",
  appId: "1:9974063516:web:60e1054904697a61a3a859"
};

// Initialisation de Firebase et Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const TEMPLATES_COLLECTION = 'templates'; // Nom de votre collection Firestore

// Mappage des slugs d'URL aux titres pour l'affichage
const categoryMap = {
    'hero': { title: 'Hero Section', dbType: 'section_hero' },
    'value': { title: 'Value Proposition / Avantages', dbType: 'section_value' },
    'features': { title: 'Features / Fonctionnalités', dbType: 'section_features' },
    'social': { title: 'Social Proof', dbType: 'section_social' },
    'about': { title: 'About / Présentation', dbType: 'section_about' },
    'cta': { title: 'Call to Action (CTA)', dbType: 'section_cta' },
    'pricing': { title: 'Pricing / Tarifs', dbType: 'section_pricing' },
    'faq': { title: 'FAQ', dbType: 'section_faq' },
    'contact': { title: 'Contact / Formulaire', dbType: 'section_contact' }
};

// Fonction utilitaire pour obtenir les infos de la catégorie
function getCategoryInfo(categorySlug) {
    return categoryMap[categorySlug];
}

// Fonction utilitaire pour extraire la catégorie de l'URL
function getUrlCategory() {
    const params = new URLSearchParams(window.location.search);
    return params.get('category');
}

// utilitaire copie dans clipboard
async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    alert('Code copié ✅');
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    alert('Code copié (fallback) ✅');
  }
}

// Combine HTML, CSS et JS dans une balise <style> et <script>
function combineCode(html, css, js){
    let combined = '';
    if(css && css.trim().length > 0) {
        combined += `<style>\n${css}\n</style>\n`;
    }
    combined += html;
    if(js && js.trim().length > 0) {
        combined += `\n<script>\n${js}\n</script>\n`;
    }
    return combined;
}

// échappement simple pour affichage brut
function escapeHtml(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}


let allTemplates = []; // Stocke les templates chargés pour les actions (edit/copy/delete)

// render list for current pageType
function renderPage(pageType){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  // Le filtrage se fait par le onSnapshot, donc allTemplates contient déjà les bons templates
  const filteredTemplates = allTemplates; 
  
  if(!filteredTemplates.length){
    grid.innerHTML = `<div class="card"><div class="small">Aucun template pour cette catégorie — ajoute le premier via le formulaire.</div></div>`;
    return;
  }

  filteredTemplates.forEach(t => {
    const card = document.createElement('div'); card.className='card';
    const combinedPreview = combineCode(t.html, t.css, t.js); 

    // Structure de la card (inclut les boutons JS)
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:600">${escapeHtml(t.name)}</div>
        <div class="small">${new Date(t.createdAt).toLocaleString()}</div>
      </div>
      <div class="meta">
        <div class="small">${t.description || ''}</div>
        <div class="controls">
          <button class="btn" data-act="copy-html" data-id="${t.id}">Copier HTML</button>
          <button class="btn" data-act="copy-css" data-id="${t.id}">Copier CSS</button>
          <button class="btn" data-act="copy-js" data-id="${t.id}">Copier JS</button> 
          
          <button class="btn" data-act="edit" data-id="${t.id}">Éditer</button>
          <button class="btn" data-act="delete" data-id="${t.id}">Supprimer</button>
          <button class="btn primary" data-act="full" data-id="${t.id}">Plein écran (Aperçu)</button>
        </div>
      </div>
      <div class="template-content">
        <div class="content-col preview-col">
          <p class="col-title">Aperçu Visuel</p>
          <div class="preview" data-id="${t.id}">${combinedPreview}</div>
        </div>
        <div class="content-col code-col" style="display:flex; flex-direction:column">
          <p class="col-title">Code HTML</p>
          <pre class="template-code html-code-preview" data-id="${t.id}" style="flex:1; margin-bottom:10px;">${escapeHtml(t.html)}</pre>
          
          <p class="col-title">Code CSS</p>
          <pre class="template-code css-code-preview" data-id="${t.id}" style="flex:1; margin-bottom:10px;">${escapeHtml(t.css || '// Pas de CSS enregistré')}</pre>

          <p class="col-title">Code JS</p> 
          <pre class="template-code js-code-preview" data-id="${t.id}" style="flex:1;">${escapeHtml(t.js || '// Pas de JavaScript enregistré')}</pre>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// open modal simple pour editing/adding
function openEditor(options){
  const {mode='add', pageType='', template=null} = options;
  const editorWrap = document.getElementById('editorWrap');
  editorWrap.dataset.mode = mode;
  // pageType contient le type réel (ex: 'header', 'section_hero')
  editorWrap.dataset.type = pageType; 
  if(template) editorWrap.dataset.id = template.id;

  const html = template ? template.html : '<div>Ton HTML ici</div>';
  const css = template ? (template.css || '') : '/* Ton CSS ici */'; 
  const js = template ? (template.js || '') : '// Ton JavaScript ici'; 

  const inputTypeElement = document.getElementById('inp-type');
  if (inputTypeElement) {
      // Mettre à jour le titre de l'éditeur (ex: 'SECTION_HERO')
      inputTypeElement.textContent = pageType.toUpperCase().replace('_', ' ');
  }

  document.getElementById('name').value = template ? template.name : '';
  document.getElementById('desc').value = template ? (template.description||'') : '';
  document.getElementById('htmlcode').value = html;
  document.getElementById('csscode').value = css;
  document.getElementById('jscode').value = js; 
  
  document.getElementById('livePreview').innerHTML = combineCode(html, css, js); 

  editorWrap.style.display = 'block';
  document.getElementById('name').focus();
}

function closeEditor(){
  document.getElementById('editorWrap').style.display = 'none';
}

// Écoute en temps réel des templates de la collection
function setupRealtimeListener(dbType) {
    const q = query(collection(db, TEMPLATES_COLLECTION), where("type", "==", dbType));
    
    onSnapshot(q, (querySnapshot) => {
        allTemplates = [];
        querySnapshot.forEach((doc) => {
            allTemplates.push({ id: doc.id, ...doc.data() });
        });
        renderPage(dbType); // Utilise le type de base de données comme référence pour le rendu
    }, (error) => {
        console.error("Erreur lors de la lecture des documents: ", error);
        const grid = document.getElementById('grid');
        grid.innerHTML = `<div class="card"><div class="small">Erreur de connexion à la base de données. Veuillez vérifier la console.</div></div>`;
    });
}


// initialize page
document.addEventListener('DOMContentLoaded', ()=>{
  let pageType = document.body.dataset.type; // 'header', 'section', ou 'footer', 'home'
  let dbType = pageType; // C'est le type utilisé pour la requête Firebase et la sauvegarde

  // --- LOGIQUE POUR LES SOUS-CATÉGORIES DE SECTIONS ---
  if (pageType === 'section') {
      const categorySlug = getUrlCategory();
      const categoryInfo = getCategoryInfo(categorySlug);
      
      const toolbar = document.getElementById('toolbar');
      const grid = document.getElementById('grid');
      
      if (categorySlug && categoryInfo) {
          // Si une catégorie est spécifiée (ex: sections.html?category=hero)
          dbType = categoryInfo.dbType; // dbType devient 'section_hero'

          // 1. Mise à jour des titres de la page
          document.title = `Sections - ${categoryInfo.title}`;
          document.getElementById('sectionTitle').textContent = `Templates : ${categoryInfo.title}`;
          document.getElementById('btnNew').textContent = `+ Nouveau template ${categoryInfo.title.split(' ')[0]}`;
          
          // 2. Lancement du listener Firebase pour cette sous-catégorie
          setupRealtimeListener(dbType);
      } else {
          // Si pas de catégorie (sections.html sans paramètre)
          // On cache la grille et les boutons d'édition car c'est la page 'Menu'
          if (toolbar) toolbar.style.display = 'none';
          if (grid) grid.innerHTML = `<div class="card"><h3>Sélectionnez une catégorie</h3><p class="small">Veuillez choisir une sous-catégorie de section dans le menu déroulant en haut.</p></div>`;
          return;
      }
  } 
  
  // --- LOGIQUE POUR HEADERS ET FOOTERS ---
  else if (pageType !== 'home') {
      // Pour 'header' et 'footer', le dbType est le même que le pageType
      setupRealtimeListener(dbType);
  }

  // Si on est sur une page de template (header, footer, ou section filtrée)

  // new button (utilise le dbType comme type de template à créer)
  const btnNew = document.getElementById('btnNew');
  if(btnNew) {
    // Notez que pour une section filtrée, pageType est toujours 'section' mais dbType est 'section_hero'
    btnNew.addEventListener('click', ()=> openEditor({mode:'add', pageType: dbType})); 
  }
  
  // Export/Import (logique non fonctionnelle)
  document.getElementById('btnExport')?.addEventListener('click', ()=>{
      alert(`L'export des templates de type ${dbType} n'est pas supporté en mode Cloud.`);
  });
  document.getElementById('btnImport')?.addEventListener('change', (e)=>{
      alert('L\'import direct n\'est pas supporté en mode Cloud.');
  });


  // submit editor
  document.getElementById('editorSave')?.addEventListener('click', async ()=>{
    const editorWrap = document.getElementById('editorWrap');
    const mode = editorWrap.dataset.mode;
    // On utilise le 'type' qui a été stocké dans l'editorWrap ('header', 'footer', ou 'section_hero')
    const type = editorWrap.dataset.type; 
    const name = document.getElementById('name').value.trim();
    const desc = document.getElementById('desc').value.trim();
    const html = document.getElementById('htmlcode').value;
    const css = document.getElementById('csscode').value; 
    const js = document.getElementById('jscode').value; 
    
    if(!name){ alert('Donne un nom'); return; }

    const data = { type, name, description: desc, html, css: css || '', js: js || '', createdAt: Date.now() }; 

    try {
        if(mode === 'add'){
            await addDoc(collection(db, TEMPLATES_COLLECTION), data);
            alert('Template ajouté à Firebase ✅');
        }else if(mode === 'edit'){
            const id = editorWrap.dataset.id;
            const templateRef = doc(db, TEMPLATES_COLLECTION, id);
            const updateData = { name, description: desc, html, css: css || '', js: js || '' }; 
            await updateDoc(templateRef, updateData);
            alert('Template mis à jour dans Firebase ✅');
        }
    } catch(e) {
        console.error("Erreur d'écriture dans Firebase: ", e);
        alert("Erreur lors de l'enregistrement du template.");
    }

    closeEditor();
  });

  document.querySelectorAll('#editorCancel').forEach(btn => btn.addEventListener('click', closeEditor));

  // delegado click sur grid
  const grid = document.getElementById('grid');
  if (grid) { 
      grid.addEventListener('click', async (e)=>{
        const btn = e.target.closest('button');
        if(!btn) return;
        const act = btn.dataset.act; 
        const id = btn.dataset.id;
        
        const t = allTemplates.find(x=>x.id===id);
        if(!t) return;

        if(act === 'copy-html'){
          copyToClipboard(t.html); 
        }else if(act === 'copy-css'){
          if (!t.css || t.css.trim() === '') {
              alert('Pas de CSS à copier pour ce template.');
              return;
          }
          copyToClipboard(t.css);
        }else if(act === 'copy-js'){ 
          if (!t.js || t.js.trim() === '') {
              alert('Pas de JavaScript à copier pour ce template.');
              return;
          }
          copyToClipboard(t.js);
        }else if(act === 'delete'){
          if(confirm('Supprimer ce template ? (Action publique et définitive)')) {
              try {
                  const docRef = doc(db, TEMPLATES_COLLECTION, id);
                  await deleteDoc(docRef);
                  alert('Template supprimé de Firebase ✅');
              } catch(e) {
                  console.error("Erreur de suppression dans Firebase: ", e);
                  alert("Erreur lors de la suppression du template.");
              }
          }
        }else if(act === 'edit'){
          // On utilise le type réel du template t.type (ex: 'section_hero') pour l'édition
          openEditor({mode:'edit', pageType:t.type, template:t});
        }else if(act === 'full'){
          const combined = combineCode(t.html, t.css, t.js); 
          const w = window.open('','_blank','width=900,height=700,scrollbars=yes');
          w.document.open();
          w.document.write(`
            <!doctype html>
            <html lang="fr">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width,initial-scale=1" />
              <title>${t.name} - Aperçu</title>
              <style>
                  body {
                      background: #071027; 
                      padding: 0;
                      margin: 0;
                      display: block;
                  }
                  .template-preview-full {
                      min-height: 100vh;
                  }
              </style>
            </head>
            <body>
              <div class="template-preview-full">
                  ${combined}
              </div>
            </body>
            </html>
          `);
          w.document.close();
        }
      });
  }

  // live preview while editing (écoute des trois champs)
  function updateLivePreview(){
      const html = document.getElementById('htmlcode').value;
      const css = document.getElementById('csscode').value;
      const js = document.getElementById('jscode').value; 
      document.getElementById('livePreview').innerHTML = combineCode(html, css, js); 
  }
  const htmlCodeElement = document.getElementById('htmlcode');
  const cssCodeElement = document.getElementById('csscode');
  const jsCodeElement = document.getElementById('jscode');

  if(htmlCodeElement) htmlCodeElement.addEventListener('input', updateLivePreview);
  if(cssCodeElement) cssCodeElement.addEventListener('input', updateLivePreview);
  if (jsCodeElement) jsCodeElement.addEventListener('input', updateLivePreview);
});