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

// utilitaire copie dans clipboard
async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    alert('Code copié ✅');
  }catch(e){
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    alert('Code copié (fallback) ✅');
  }
}

// Combine HTML et CSS dans une balise <style>
function combineCode(html, css){
    let combined = '';
    if(css && css.trim().length > 0) {
        combined += `<style>\n${css}\n</style>\n`;
    }
    combined += html;
    return combined;
}

// Helper function to create the full isolated HTML document for an iframe
function createIframeContent(html, css, name = 'Aperçu'){
  const combined = combineCode(html, css);
  
  // Charge les styles globaux pour que les boutons et couleurs fonctionnent dans l'iframe
  return `
    <!doctype html>
    <html lang="fr">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${name}</title>
        
        <link rel="stylesheet" href="assets/styles.css" /> 
        
        <style>
            /* Surcharge minimale pour le contexte de l'aperçu */
            body { 
                margin: 0; 
                padding: 10px; 
                background-color: var(--bg, #0f172a); 
            }
        </style>
    </head>
    <body>
        ${combined}
    </body>
    </html>
  `;
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
  const filteredTemplates = allTemplates.filter(t => t.type === pageType);
  
  if(!filteredTemplates.length){
    grid.innerHTML = `<div class="card"><div class="small">Aucun template ${pageType} — ajoute le premier via le formulaire.</div></div>`;
    return;
  }

  filteredTemplates.forEach(t => {
    const card = document.createElement('div'); card.className='card';
    
    // Structure de la card
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
          
          <button class="btn" data-act="edit" data-id="${t.id}">Éditer</button>
          <button class="btn" data-act="delete" data-id="${t.id}">Supprimer</button>
          <button class="btn primary" data-act="full" data-id="${t.id}">Plein écran (Aperçu)</button>
        </div>
      </div>
      <div class="template-content">
        <div class="content-col preview-col">
          <p class="col-title">Aperçu Visuel</p>
          <div class="preview-iframe-wrapper" data-id="${t.id}"></div>
        </div>
        <div class="content-col code-col" style="display:flex; flex-direction:column">
          <p class="col-title">Code HTML</p>
          <pre class="template-code html-code-preview" data-id="${t.id}" style="flex:1; margin-bottom:10px;">${escapeHtml(t.html)}</pre>
          
          <p class="col-title">Code CSS</p>
          <pre class="template-code css-code-preview" data-id="${t.id}" style="flex:1;">${escapeHtml(t.css || '// Pas de CSS enregistré')}</pre>
        </div>
      </div>
    `;
    grid.appendChild(card);

    // --- LOGIQUE D'INJECTION DE L'IFRAME POUR LA LISTE ---
    const iframeWrapper = card.querySelector('.preview-iframe-wrapper');
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-iframe-list'; // Classe pour le style dans styles.css
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframeWrapper.appendChild(iframe);
    
    // Injection du contenu
    const iframeContent = createIframeContent(t.html, t.css, t.name);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(iframeContent);
    iframe.contentWindow.document.close();
    // --- FIN LOGIQUE IFRAME ---
  });
}

// open modal simple pour editing/adding
function openEditor(options){
  const {mode='add', pageType='', template=null} = options;
  const editorWrap = document.getElementById('editorWrap');
  editorWrap.dataset.mode = mode;
  editorWrap.dataset.type = pageType;
  if(template) editorWrap.dataset.id = template.id;

  const html = template ? template.html : '<div>Ton HTML ici</div>';
  const css = template ? (template.css || '') : '/* Ton CSS ici */'; 

  document.getElementById('inp-type').textContent = pageType.toUpperCase();
  document.getElementById('name').value = template ? template.name : '';
  document.getElementById('desc').value = template ? (template.description||'') : '';
  document.getElementById('htmlcode').value = html;
  document.getElementById('csscode').value = css;
  
  // --- LOGIQUE D'INJECTION DE L'IFRAME POUR L'ÉDITEUR ---
  const iframeContent = createIframeContent(html, css, template ? template.name : 'Nouvelle Section');
  const previewIframe = document.getElementById('livePreview'); 
  
  previewIframe.contentWindow.document.open();
  previewIframe.contentWindow.document.write(iframeContent);
  previewIframe.contentWindow.document.close();
  // --- FIN LOGIQUE IFRAME ---
  
  // NOUVEAUTÉ: Ajoute une classe pour masquer la barre de navigation hôte
  document.body.classList.add('editor-open'); 

  editorWrap.style.display = 'block';
  document.getElementById('name').focus();
}

function closeEditor(){
  // NOUVEAUTÉ: Retire la classe pour réafficher la barre de navigation hôte
  document.body.classList.remove('editor-open'); 
  
  document.getElementById('editorWrap').style.display = 'none';
}

// Écoute en temps réel des templates de la collection
function setupRealtimeListener(pageType) {
    const q = collection(db, TEMPLATES_COLLECTION);
    
    // onSnapshot fournit une mise à jour en temps réel des données
    onSnapshot(q, (querySnapshot) => {
        allTemplates = [];
        querySnapshot.forEach((doc) => {
            // Stocke l'ID du document Firestore comme 'id' du template
            allTemplates.push({ id: doc.id, ...doc.data() });
        });
        // Une fois les données mises à jour, on rafraîchit l'affichage
        renderPage(pageType);
    }, (error) => {
        console.error("Erreur lors de la lecture des documents: ", error);
        // Fallback si la connexion Firebase échoue
        const grid = document.getElementById('grid');
        grid.innerHTML = `<div class="card"><div class="small">Erreur de connexion à la base de données. Veuillez vérifier la console.</div></div>`;
    });
}


// initialize page
document.addEventListener('DOMContentLoaded', ()=>{
  const pageType = document.body.dataset.type; // 'header', 'section', 'footer', ou 'home'

  if (pageType !== 'home') {
      setupRealtimeListener(pageType);
  }

  // new button
  document.getElementById('btnNew').addEventListener('click', ()=> openEditor({mode:'add', pageType}));
  
  // Export (logique non fonctionnelle sans loadTemplates/saveTemplates)
  document.getElementById('btnExport').addEventListener('click', ()=>{
      alert('L\'export direct de tous les templates n\'est pas supporté en mode Cloud. Utilisez la console Firebase pour les exports.');
  });
  // Import (logique non fonctionnelle)
  document.getElementById('btnImport').addEventListener('change', (e)=>{
      alert('L\'import direct n\'est pas supporté en mode Cloud.');
  });


  // submit editor
  document.getElementById('editorSave').addEventListener('click', async ()=>{
    const editorWrap = document.getElementById('editorWrap');
    const mode = editorWrap.dataset.mode;
    const type = editorWrap.dataset.type;
    const name = document.getElementById('name').value.trim();
    const desc = document.getElementById('desc').value.trim();
    const html = document.getElementById('htmlcode').value;
    const css = document.getElementById('csscode').value; 
    
    if(!name){ alert('Donne un nom'); return; }

    const data = { type, name, description: desc, html, css: css || '', createdAt: Date.now() }; 

    try {
        if(mode === 'add'){
            await addDoc(collection(db, TEMPLATES_COLLECTION), data);
            alert('Template ajouté à Firebase ✅');
        }else if(mode === 'edit'){
            const id = editorWrap.dataset.id;
            const templateRef = doc(db, TEMPLATES_COLLECTION, id);
            // On met à jour sans modifier le createdAt
            const updateData = { name, description: desc, html, css: css || '' };
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
  document.getElementById('grid').addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const act = btn.dataset.act; 
    const id = btn.dataset.id;
    
    // Utilise la liste chargée en mémoire (allTemplates)
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
    }else if(act === 'delete'){
      if(confirm('Supprimer ce template ? (Action publique et définitive)')) {
          try {
              const docRef = doc(db, TEMPLATES_COLLECTION, id);
              await deleteDoc(docRef);
              alert('Template supprimé de Firebase ✅');
              // L'onSnapshot va rafraîchir la page
          } catch(e) {
              console.error("Erreur de suppression dans Firebase: ", e);
              alert("Erreur lors de la suppression du template.");
          }
      }
    }else if(act === 'edit'){
      openEditor({mode:'edit', pageType:t.type, template:t});
    }else if(act === 'full'){
      const combined = combineCode(t.html, t.css); 
      // Afficher l'aperçu en plein écran
      const w = window.open('','_blank','width=900,height=700,scrollbars=yes');
      w.document.open();
      w.document.write(`
        <!doctype html>
        <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${t.name} - Aperçu</title>
          
          <link rel="stylesheet" href="assets/styles.css" /> 
          
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

  // live preview while editing (écoute des deux champs)
  function updateLivePreview(){
      const html = document.getElementById('htmlcode').value;
      const css = document.getElementById('csscode').value;
      
      // --- LOGIQUE D'INJECTION DE L'IFRAME POUR L'ÉDITEUR ---
      const iframeContent = createIframeContent(html, css, 'Aperçu en direct');
      const previewIframe = document.getElementById('livePreview');

      previewIframe.contentWindow.document.open();
      previewIframe.contentWindow.document.write(iframeContent);
      previewIframe.contentWindow.document.close();
      // --- FIN LOGIQUE IFRAME ---
  }
  document.getElementById('htmlcode').addEventListener('input', updateLivePreview);
  const cssCodeElement = document.getElementById('csscode');
  if (cssCodeElement) {
      cssCodeElement.addEventListener('input', updateLivePreview);
  }
});