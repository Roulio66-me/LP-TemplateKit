/* assets/app.js - Kit de Templates Simplifié avec Firebase Firestore */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";

// Votre configuration Firebase (DOIT RESTER INTACTE)
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
const TEMPLATES_COLLECTION = 'templates'; 

let allTemplates = []; // Stockage local de tous les templates
let currentPageType = ''; // Type de template actuel (header, section, footer)

// --- Fonctions d'Utilité ---

function getUrlParameter(name) {
    name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
    const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
    const results = regex.exec(location.search);
    return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Combine HTML et CSS
function combineCode(html, css){
    let combined = '';
    if(css && css.trim().length > 0) {
        combined += `<style>\n${css}\n</style>\n`;
    }
    combined += html;
    return combined;
}

// Crée le contenu isolé pour les iframes (aperçus)
function createIframeContent(html, css, name = 'Aperçu'){
  const combined = combineCode(html, css);
  return `
    <!doctype html>
    <html lang="fr">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>${name}</title>
        <link rel="stylesheet" href="/assets/styles.css" /> 
        <style>
            body { margin: 0; padding: 10px; background-color: var(--bg, #0f172a); }
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

// --- Fonctions de Rendu et Éditeur ---

function renderPage(pageType){
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const filteredTemplates = allTemplates.filter(t => t.type === pageType);
  
  if(!filteredTemplates.length){
    grid.innerHTML = `<div class="card"><div class="small">Aucun template ${pageType} — ajoutez le premier.</div></div>`;
    return;
  }

  filteredTemplates.forEach(t => {
    const card = document.createElement('div'); card.className='card';
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
          <button class="btn primary" data-act="full" data-id="${t.id}">Plein écran</button>
        </div>
      </div>
      <div class="template-content">
        <div class="content-col preview-col">
          <p class="col-title">Aperçu Visuel</p>
          <div class="preview-iframe-wrapper" data-id="${t.id}"></div>
        </div>
        <div class="content-col code-col" style="display:flex; flex-direction:column">
          <p class="col-title">Code HTML</p>
          <pre class="template-code html-code-preview" style="flex:1">${escapeHtml(t.html)}</pre>
          <p class="col-title">Code CSS</p>
          <pre class="template-code css-code-preview" style="flex:1;">${escapeHtml(t.css || '// Pas de CSS enregistré')}</pre>
        </div>
      </div>
    `;
    grid.appendChild(card);

    // Injection de l'iframe pour l'aperçu
    const iframeWrapper = card.querySelector('.preview-iframe-wrapper');
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-iframe-list'; 
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframeWrapper.appendChild(iframe);
    
    const iframeContent = createIframeContent(t.html, t.css, t.name);
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(iframeContent);
    iframe.contentWindow.document.close();
  });
}


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
  
  // Rendre l'aperçu initial
  const iframeContent = createIframeContent(html, css, template ? template.name : 'Nouvelle Section');
  const previewIframe = document.getElementById('livePreview'); 
  previewIframe.contentWindow.document.open();
  previewIframe.contentWindow.document.write(iframeContent);
  previewIframe.contentWindow.document.close();
  
  document.body.classList.add('editor-open'); 
  editorWrap.style.display = 'block';
  document.getElementById('name').focus();
}

function closeEditor(){
  document.body.classList.remove('editor-open'); 
  document.getElementById('editorWrap').style.display = 'none';
}

// Événement: Live preview pendant l'édition
function updateLivePreview(){
    const html = document.getElementById('htmlcode').value;
    const css = document.getElementById('csscode').value;
    const iframeContent = createIframeContent(html, css, 'Aperçu en direct');
    const previewIframe = document.getElementById('livePreview');
    previewIframe.contentWindow.document.open();
    previewIframe.contentWindow.document.write(iframeContent);
    previewIframe.contentWindow.document.close();
}

// Écoute en temps réel des templates de la collection
function setupRealtimeListener(pageType) {
    const q = collection(db, TEMPLATES_COLLECTION);
    
    onSnapshot(q, (querySnapshot) => {
        allTemplates = [];
        querySnapshot.forEach((doc) => {
            allTemplates.push({ id: doc.id, ...doc.data() });
        });
        renderPage(pageType);
    }, (error) => {
        console.error("Erreur de connexion à Firebase: ", error);
        document.getElementById('grid').innerHTML = `<div class="card"><div class="small">Erreur de connexion à la base de données. Vérifiez la console (F12) et les règles de sécurité Firebase.</div></div>`;
    });
}


// --- Démarrage de l'Application ---
document.addEventListener('DOMContentLoaded', ()=>{
  
  currentPageType = getUrlParameter('type');
  
  if (document.body.dataset.type === 'template-page' && currentPageType) {
      
      const capitalizedType = currentPageType.charAt(0).toUpperCase() + currentPageType.slice(1);
      const btnNew = document.getElementById('btnNew');

      // Mise à jour du bouton Nouveau
      if (btnNew) {
          btnNew.textContent = `+ Nouveau ${capitalizedType}`;
          btnNew.addEventListener('click', () => {
              openEditor({mode:'add', pageType: currentPageType});
          });
      }
      
      // Démarrage de l'écoute Firebase
      setupRealtimeListener(currentPageType);
  }

  // Événement: Soumission de l'éditeur (Enregistrer)
  document.getElementById('editorSave').addEventListener('click', async ()=>{
    const editorWrap = document.getElementById('editorWrap');
    const mode = editorWrap.dataset.mode;
    const type = editorWrap.dataset.type;
    const name = document.getElementById('name').value.trim();
    const desc = document.getElementById('desc').value.trim();
    const html = document.getElementById('htmlcode').value;
    const css = document.getElementById('csscode').value; 
    
    if(!name){ alert('Veuillez donner un nom au template.'); return; }

    const data = { type, name, description: desc, html, css: css || '', createdAt: Date.now() }; 

    try {
        if(mode === 'add'){
            await addDoc(collection(db, TEMPLATES_COLLECTION), data);
            alert('Template ajouté à Firebase ✅');
        }else if(mode === 'edit'){
            const id = editorWrap.dataset.id;
            const templateRef = doc(db, TEMPLATES_COLLECTION, id);
            const updateData = { name, description: desc, html, css: css || '' };
            await updateDoc(templateRef, updateData);
            alert('Template mis à jour dans Firebase ✅');
        }
        closeEditor();
    } catch(e) {
        console.error("ERREUR D'ÉCRITURE DANS FIREBASE: ", e);
        alert(`Erreur lors de l'enregistrement. Vérifiez les règles de sécurité Firebase (allow write) : ${e.message}`);
    }

  });

  // Événements d'annulation
  document.querySelectorAll('#editorCancel').forEach(btn => btn.addEventListener('click', closeEditor));
  
  // Événement délégué: Clic sur la grille (Copier, Éditer, Supprimer, Plein Écran)
  document.getElementById('grid')?.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;
    const act = btn.dataset.act; 
    const id = btn.dataset.id;
    
    const t = allTemplates.find(x=>x.id===id);
    if(!t) return;

    if(act === 'copy-html'){
      copyToClipboard(combineCode(t.html, t.css)); // Copie HTML + CSS
    }else if(act === 'copy-css'){
      copyToClipboard(t.css || '');
    }else if(act === 'delete'){
      if(confirm('Supprimer ce template ? (Action définitive)')) {
          try {
              await deleteDoc(doc(db, TEMPLATES_COLLECTION, id));
              alert('Template supprimé de Firebase ✅');
          } catch(e) {
              console.error("ERREUR DE SUPPRESSION FIREBASE: ", e);
              alert(`Erreur lors de la suppression. Vérifiez les règles de sécurité Firebase (allow delete) : ${e.message}`);
          }
      }
    }else if(act === 'edit'){
      openEditor({mode:'edit', pageType:t.type, template:t});
    }else if(act === 'full'){
      const combined = createIframeContent(t.html, t.css, t.name);
      const w = window.open('','_blank','width=900,height=700,scrollbars=yes');
      w.document.open();
      w.document.write(combined);
      w.document.close();
    }
  });

  // Événement: Live preview
  document.getElementById('htmlcode')?.addEventListener('input', updateLivePreview);
  document.getElementById('csscode')?.addEventListener('input', updateLivePreview);
});