/**
 * LP-TemplateKit - Logique Applicative (app.js)
 * UTILISE LE SDK FIREBASE V12 EN MODE MODULES ES
 */

// Importations modulaires de Firebase
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Récupération de l'instance de l'application initialisée dans templates.html
const firebaseApp = window.firebaseApp;

if (firebaseApp) {
    // Initialisation Firestore
    const db = getFirestore(firebaseApp);
    const templatesCollection = collection(db, 'templates');

    // Référence au conteneur principal
    const templatesContainer = document.getElementById('templates-container');
    // Références à la Modal
    const editorModal = document.getElementById('editor-modal');
    const modalTitle = document.getElementById('modal-title');
    const closeBtn = editorModal ? editorModal.querySelector('.close-btn') : null;
    const templateForm = document.getElementById('template-form');
    // Références aux champs du formulaire
    const templateIdField = document.getElementById('template-id');
    const templateTypeField = document.getElementById('template-type');
    const templateNameField = document.getElementById('template-name');
    const templateDescriptionField = document.getElementById('template-description');
    const templateHtmlField = document.getElementById('template-html');
    const templateCssField = document.getElementById('template-css');
    const livePreviewIframe = document.getElementById('live-preview-iframe');
    const saveButton = document.getElementById('save-button');
    const openCreateModalBtn = document.getElementById('open-create-modal');

    // Type de template actuel (header, section, footer)
    let currentTemplateType = '';
    
    // --- II. Fonctions de Rendu et Utilitaires ---

    /**
     * F06: Met à jour l'aperçu en temps réel dans l'iframe.
     * @param {string} htmlCode 
     * @param {string} cssCode 
     */
    function updateLivePreview(htmlCode, cssCode) {
        if (!livePreviewIframe) return;

        const iframeContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <style>
                    /* Styles CSS injectés (pour l'isolation) */
                    ${cssCode}
                </style>
                <style>
                    /* Injection des variables CSS hôtes pour le thème (pour réutilisation) */
                    :root {
                        --color-primary: #007bff;
                        --color-secondary: #6c757d;
                        --color-bg-light: #f8f9fa;
                        --color-bg-dark: #343a40;
                        --color-text-light: #f8f9fa;
                        --color-text-dark: #212529;
                        --font-family: 'Inter', sans-serif;
                    }
                    body { margin: 0; padding: 0; font-family: var(--font-family); }
                </style>
            </head>
            <body>
                ${htmlCode}
            </body>
            </html>
        `;

        livePreviewIframe.contentDocument.open();
        livePreviewIframe.contentDocument.write(iframeContent);
        livePreviewIframe.contentDocument.close();
    }

    /**
     * Crée une carte de template (F03) dans le DOM.
     * @param {Object} template - Le document Firestore (QueryDocumentSnapshot).
     */
    function createTemplateCard(template) {
        const docId = template.id;
        const data = template.data();

        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.id = docId;

        const iframeContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <style>
                    ${data.css}
                    body { margin: 0; padding: 0; font-family: sans-serif; }
                </style>
            </head>
            <body>
                ${data.html}
            </body>
            </html>
        `;

        card.innerHTML = `
            <div class="template-card-header">
                <h3>${data.name}</h3>
                <p>${data.description}</p>
            </div>
            <div class="template-preview-wrapper">
                <iframe 
                    title="Aperçu du Template ${data.name}" 
                    sandbox="allow-scripts allow-same-origin"
                ></iframe>
            </div>
            <div class="template-actions">
                <div class="crud-actions">
                    <button class="btn btn-secondary btn-small edit-btn" data-id="${docId}">Modifier (F04)</button>
                    <button class="btn btn-danger btn-small delete-btn" data-id="${docId}">Supprimer (F05)</button>
                </div>
                <div class="quick-actions">
                    <button class="btn btn-small copy-html-btn" data-id="${docId}">Copier HTML (F07)</button>
                    <button class="btn btn-small copy-css-btn" data-id="${docId}">Copier CSS (F07)</button>
                    <button class="btn btn-primary btn-small fullscreen-btn" data-id="${docId}">Plein Écran (F07)</button>
                </div>
            </div>
        `;

        const iframe = card.querySelector('iframe');
        iframe.contentDocument.open();
        iframe.contentDocument.write(iframeContent);
        iframe.contentDocument.close();

        return card;
    }

    /**
     * Gère l'affichage des templates à partir d'un snapshot Firestore. (F08)
     * @param {Object} snapshot - Le QuerySnapshot de Firestore.
     */
    function renderTemplates(snapshot) {
        if (!templatesContainer) return;
        
        templatesContainer.innerHTML = ''; 

        if (snapshot.empty) {
            templatesContainer.innerHTML = `<p class="empty-state">Aucun template de type "${currentTemplateType}" trouvé. Créez-en un !</p>`;
            return;
        }

        snapshot.forEach(doc => {
            const card = createTemplateCard(doc);
            templatesContainer.appendChild(card);
        });
    }

    // --- III. Fonctions CRUD et Gestion d'Événements ---

    /**
     * Ouvre la modal en mode Création ou Modification.
     * @param {Object} [templateData=null] - Données du template pour la modification (F04).
     * @param {string} [docId=null] - ID du document pour la modification (F04).
     */
    function openModal(templateData = null, docId = null) {
        if (!editorModal) return;

        templateForm.reset();
        templateIdField.value = '';
        templateTypeField.value = currentTemplateType;
        
        if (templateData) {
            // Mode Modification (F04)
            modalTitle.textContent = 'Modifier le Template';
            saveButton.textContent = 'Enregistrer les Modifications';
            templateIdField.value = docId;
            templateNameField.value = templateData.name;
            templateDescriptionField.value = templateData.description;
            templateHtmlField.value = templateData.html;
            templateCssField.value = templateData.css;
            updateLivePreview(templateData.html, templateData.css);
        } else {
            // Mode Création (F02)
            modalTitle.textContent = `Créer un Nouveau ${currentTemplateType.charAt(0).toUpperCase() + currentTemplateType.slice(1)}`;
            saveButton.textContent = 'Créer le Template';
            updateLivePreview('\n\n<h1>Titre du Composant</h1>', '/* Votre CSS ici */');
        }

        editorModal.style.display = 'block';
    }

    /**
     * Ferme la modal.
     */
    function closeModal() {
        if (editorModal) {
            editorModal.style.display = 'none';
        }
    }

    /**
     * F02, F04: Gère la soumission du formulaire (Création ou Mise à Jour).
     * @param {Event} e 
     */
    async function handleFormSubmit(e) {
        e.preventDefault();

        const id = templateIdField.value;
        const data = {
            type: templateTypeField.value,
            name: templateNameField.value,
            description: templateDescriptionField.value,
            html: templateHtmlField.value,
            css: templateCssField.value,
        };

        try {
            if (id) {
                // Mise à Jour (Update - F04)
                await updateDoc(doc(db, 'templates', id), data);
                alert('Template mis à jour avec succès !');
            } else {
                // Création (Create - F02)
                data.createdAt = serverTimestamp();
                await addDoc(templatesCollection, data);
                alert('Template créé avec succès !');
            }
            closeModal();
        } catch (error) {
            console.error("Erreur CRUD: ", error);
            alert("Erreur lors de l'opération. Vérifiez vos règles de sécurité Firestore.");
        }
    }

    /**
     * F05: Gère la suppression d'un template.
     * @param {string} docId 
     */
    async function deleteTemplate(docId) {
        if (confirm("Êtes-vous sûr de vouloir supprimer définitivement ce template ? (F05)")) {
            try {
                await deleteDoc(doc(db, 'templates', docId));
                alert('Template supprimé avec succès !');
            } catch (error) {
                console.error("Erreur de suppression: ", error);
                alert("Erreur lors de la suppression du template.");
            }
        }
    }

    /**
     * F07: Copie le code dans le presse-papiers.
     * @param {string} text - Le texte à copier.
     * @param {string} type - 'HTML' ou 'CSS'.
     */
    function copyToClipboard(text, type) {
        navigator.clipboard.writeText(text).then(() => {
            alert(`${type} copié dans le presse-papiers !`);
        }).catch(err => {
            console.error('Erreur de copie:', err);
            alert("Erreur lors de la copie.");
        });
    }

    // --- IV. Initialisation et Écoute (Listeners) ---

    // 1. Gérer le Type de Template (F01)
    const urlParams = new URLSearchParams(window.location.search);
    currentTemplateType = urlParams.get('type') || 'header'; 

    const titleMap = {
        'header': 'Headers',
        'section': 'Sections',
        'footer': 'Footers'
    };
    
    if (document.getElementById('current-category-title')) {
        document.getElementById('current-category-title').textContent = titleMap[currentTemplateType] || 'Templates';
        document.title = `LP-TemplateKit | ${titleMap[currentTemplateType] || 'Templates'}`;
    }

    // 2. Écoute en Temps Réel (F08)
    if (templatesContainer) {
        const q = query(
            templatesCollection,
            where('type', '==', currentTemplateType),
            orderBy('createdAt', 'desc')
        );

        onSnapshot(q, renderTemplates, error => {
            console.error("Erreur onSnapshot: ", error);
            templatesContainer.innerHTML = '<p class="error-state">Erreur lors du chargement des templates. Vérifiez vos règles de sécurité Firestore.</p>';
        });
    }

    // 3. Événements de l'Interface

    if (openCreateModalBtn) {
        openCreateModalBtn.addEventListener('click', () => openModal());
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    window.onclick = function(event) {
        if (event.target === editorModal) {
            closeModal();
        }
    }

    // Live Preview (F06)
    if (templateHtmlField && templateCssField) {
        let previewTimeout;
        const updatePreview = () => {
             clearTimeout(previewTimeout);
             previewTimeout = setTimeout(() => {
                updateLivePreview(templateHtmlField.value, templateCssField.value);
            }, 150); 
        };
        templateHtmlField.addEventListener('input', updatePreview);
        templateCssField.addEventListener('input', updatePreview);
    }
    
    if (templateForm) {
        templateForm.addEventListener('submit', handleFormSubmit);
    }

    // Événements délégués (CRUD + Actions Rapides)
    if (templatesContainer) {
        templatesContainer.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            
            const templateRef = doc(db, 'templates', id);

            if (e.target.classList.contains('edit-btn')) {
                try {
                    const docSnap = await getDoc(templateRef);
                    if (docSnap.exists()) {
                        openModal(docSnap.data(), id);
                    } else {
                        alert("Template non trouvé.");
                    }
                } catch (error) {
                    console.error("Erreur de récupération pour modification:", error);
                }
            } 
            else if (e.target.classList.contains('delete-btn')) {
                deleteTemplate(id);
            } 
            else if (e.target.classList.contains('copy-html-btn') || e.target.classList.contains('copy-css-btn')) {
                try {
                    const docSnap = await getDoc(templateRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (e.target.classList.contains('copy-html-btn')) {
                            copyToClipboard(data.html, 'HTML');
                        } else {
                            copyToClipboard(data.css, 'CSS');
                        }
                    }
                } catch (error) {
                    console.error("Erreur de récupération pour copie:", error);
                }
            }
            else if (e.target.classList.contains('fullscreen-btn')) {
                const card = e.target.closest('.template-card');
                const iframe = card ? card.querySelector('iframe') : null;
                if (iframe) {
                    const fullScreenModal = document.createElement('div');
                    fullScreenModal.className = 'fullscreen-modal';
                    fullScreenModal.innerHTML = `
                        <span class="close-btn">&times;</span>
                        <iframe style="width:100%; height:100%; border:none;" srcdoc="${iframe.contentDocument.documentElement.outerHTML}" sandbox="allow-scripts allow-same-origin"></iframe>
                    `;
                    
                    fullScreenModal.querySelector('.close-btn').onclick = () => {
                        document.body.removeChild(fullScreenModal);
                    };
                    document.body.appendChild(fullScreenModal);
                    fullScreenModal.style.display = 'block';
                }
            }
        });
    }

} else {
    // Si l'initialisation a échoué (peu probable avec la méthode module)
    const templatesContainer = document.getElementById('templates-container');
    if(templatesContainer) {
        templatesContainer.innerHTML = '<p class="error-state">ERREUR: L\'initialisation de Firebase a échoué. Vérifiez vos clés et la console.</p>';
    }
}