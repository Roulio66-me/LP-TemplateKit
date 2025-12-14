/**
 * LP-TemplateKit - Logique Applicative (app.js)
 * Implémente le CRUD, le Live Preview et l'écoute en temps réel (onSnapshot)
 * en utilisant Firebase Firestore et JavaScript Vanilla.
 *
 * NOTE : REMPLACEZ LES PLACEHOLDERS CI-DESSOUS PAR VOTRE CONFIGURATION FIREBASE RÉELLE.
 */

// --- I. Configuration Firebase (Section III) ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialisation de Firebase
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const templatesCollection = db.collection('templates');
    
    // Pour les timestamps (createdAt)
    const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

    // Référence au conteneur principal
    const templatesContainer = document.getElementById('templates-container');
    // Références à la Modal
    const editorModal = document.getElementById('editor-modal');
    const modalTitle = document.getElementById('modal-title');
    const closeBtn = editorModal ? editorModal.querySelector('.close-btn') : null;
    const templateForm = document.getElementById('template-form');
    // Références aux champs du formulaire
    const templateIdField = document.getElementById('template-id');
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

        // Le HTML complet avec les styles CSS globaux injectés
        const iframeContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <style>
                    /* Styles CSS injectés (pour l'isolation) */
                    ${cssCode}
                </style>
                <style>
                    /* Injection des variables CSS hôtes pour le thème */
                    :root {
                        --color-primary: #007bff;
                        --color-secondary: #6c757d;
                        --color-bg-light: #f8f9fa;
                        --color-bg-dark: #343a40;
                        --color-text-light: #f8f9fa;
                        --color-text-dark: #212529;
                        --font-family: 'Inter', sans-serif;
                    }
                    /* Le corps de l'iframe est par défaut blanc pour le rendu de composant */
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
     * @param {Object} template - Le document Firestore.
     */
    function createTemplateCard(template) {
        const docId = template.id;
        const data = template.data();

        const card = document.createElement('div');
        card.className = 'template-card';
        card.dataset.id = docId;

        // Contenu de l'iframe pour l'aperçu de la carte
        const iframeContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <style>
                    ${data.css}
                    /* Styles minimal pour le rendu de la carte */
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
        
        // Nettoyer les cartes existantes pour l'écoute en temps réel
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

        // Réinitialiser le formulaire
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
            // Initialisation de l'aperçu pour la création
            updateLivePreview('<h1>Votre HTML ici</h1>', '/* Votre CSS ici */');
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
    function handleFormSubmit(e) {
        e.preventDefault();

        const id = templateIdField.value;
        const data = {
            type: templateTypeField.value,
            name: templateNameField.value,
            description: templateDescriptionField.value,
            html: templateHtmlField.value,
            css: templateCssField.value,
        };

        if (id) {
            // Mise à Jour (Update - F04)
            templatesCollection.doc(id).update(data)
                .then(() => {
                    alert('Template mis à jour avec succès !');
                    closeModal();
                })
                .catch(error => {
                    console.error("Erreur de mise à jour: ", error);
                    alert("Erreur lors de la mise à jour du template.");
                });
        } else {
            // Création (Create - F02)
            data.createdAt = serverTimestamp();
            templatesCollection.add(data)
                .then(() => {
                    alert('Template créé avec succès !');
                    closeModal();
                })
                .catch(error => {
                    console.error("Erreur de création: ", error);
                    alert("Erreur lors de la création du template.");
                });
        }
    }

    /**
     * F05: Gère la suppression d'un template.
     * @param {string} docId 
     */
    function deleteTemplate(docId) {
        if (confirm("Êtes-vous sûr de vouloir supprimer définitivement ce template ? Cette action est irréversible. (F05)")) {
            templatesCollection.doc(docId).delete()
                .then(() => {
                    alert('Template supprimé avec succès !');
                })
                .catch(error => {
                    console.error("Erreur de suppression: ", error);
                    alert("Erreur lors de la suppression du template.");
                });
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
            alert("Erreur lors de la copie. Le navigateur ne supporte pas l'API ou l'accès a été refusé.");
        });
    }

    // --- IV. Initialisation et Écoute (Listeners) ---

    // 1. Gérer le Type de Template (F01)
    const urlParams = new URLSearchParams(window.location.search);
    currentTemplateType = urlParams.get('type') || 'header'; // Défaut à 'header'

    const titleMap = {
        'header': 'Headers',
        'section': 'Sections',
        'footer': 'Footers'
    };
    
    // Mettre à jour le titre de la page et de la section
    if (document.getElementById('current-category-title')) {
        document.getElementById('current-category-title').textContent = titleMap[currentTemplateType] || 'Templates';
        document.title = `LP-TemplateKit | ${titleMap[currentTemplateType] || 'Templates'}`;
    }

    // 2. Écoute en Temps Réel (F08)
    if (templatesContainer) {
        templatesCollection
            .where('type', '==', currentTemplateType)
            .orderBy('createdAt', 'desc') // Optionnel, pour un meilleur affichage
            .onSnapshot(renderTemplates, error => {
                console.error("Erreur onSnapshot: ", error);
                templatesContainer.innerHTML = '<p class="error-state">Erreur lors du chargement des templates. Vérifiez la configuration et les règles de sécurité Firestore.</p>';
            });
    }

    // 3. Événements de l'Interface

    // Événement d'ouverture de la modal (F02)
    if (openCreateModalBtn) {
        openCreateModalBtn.addEventListener('click', () => openModal());
    }

    // Événement de fermeture de la modal
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    window.onclick = function(event) {
        if (event.target === editorModal) {
            closeModal();
        }
    }

    // Événement de soumission du formulaire (F02, F04)
    if (templateForm) {
        templateForm.addEventListener('submit', handleFormSubmit);
    }

    // Événements d'entrée pour le Live Preview (F06)
    if (templateHtmlField && templateCssField) {
        const updatePreview = () => updateLivePreview(templateHtmlField.value, templateCssField.value);
        templateHtmlField.addEventListener('input', updatePreview);
        templateCssField.addEventListener('input', updatePreview);
    }
    
    // Événements de clic délégués sur le conteneur des templates pour le CRUD et les Actions Rapides
    if (templatesContainer) {
        templatesContainer.addEventListener('click', async (e) => {
            const id = e.target.dataset.id;
            if (!id) return;
            
            // F04: Modifier
            if (e.target.classList.contains('edit-btn')) {
                try {
                    const doc = await templatesCollection.doc(id).get();
                    if (doc.exists) {
                        openModal(doc.data(), id);
                    } else {
                        alert("Template non trouvé.");
                    }
                } catch (error) {
                    console.error("Erreur de récupération pour modification:", error);
                }
            } 
            // F05: Supprimer
            else if (e.target.classList.contains('delete-btn')) {
                deleteTemplate(id);
            } 
            // F07: Copier HTML / CSS
            else if (e.target.classList.contains('copy-html-btn') || e.target.classList.contains('copy-css-btn')) {
                try {
                    const doc = await templatesCollection.doc(id).get();
                    if (doc.exists) {
                        const data = doc.data();
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
            // F07: Plein Écran
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
    // Afficher une erreur si le SDK Firebase n'est pas chargé
    const templatesContainer = document.getElementById('templates-container');
    if(templatesContainer) {
        templatesContainer.innerHTML = '<p class="error-state">ERREUR: Le SDK Firebase n\'a pas été chargé. Vérifiez vos balises &lt;script&gt; dans templates.html.</p>';
    }
}