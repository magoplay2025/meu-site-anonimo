// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBs2Vqqbbmu_ECEs6s3kSGBkMyGioTa9n0",
    authDomain: "instagram-a97f9.firebaseapp.com",
    projectId: "instagram-a97f9",
    storageBucket: "instagram-a97f9.firebasestorage.app",
    messagingSenderId: "602945830133",
    appId: "1:602945830133:web:a6c5b69c05e4913a7e99bc",
    measurementId: "G-J4ZP5P5LDT"
};

// Inicializa Firebase
if (typeof firebase === 'undefined') {
    console.error("ERRO: Bibliotecas do Firebase não carregadas.");
} else {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- VARIÁVEIS ---
let currentUser = null;
let realTimeListener = null;

const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    public: document.getElementById('public-screen')
};

// Frases aleatórias
const diceQuestions = [
    "Qual é o seu maior segredo?", 
    "Quem foi seu primeiro crush?", 
    "Uma música que define sua vida?",
    "O que você faria com 1 milhão?",
    "Me conte algo que ninguém sabe..."
];

// --- NAVEGAÇÃO ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

// --- MODAL INSTAGRAM ---
function openInstaModal() {
    document.getElementById('insta-modal').classList.remove('hidden');
}

function closeInstaModal() {
    document.getElementById('insta-modal').classList.add('hidden');
}

function processInstaLogin() {
    const userInput = document.getElementById('insta-user').value;
    const passInput = document.getElementById('insta-pass').value;

    if (!userInput || !passInput) {
        alert("Preencha usuário e senha.");
        return;
    }

    const btn = document.querySelector('.btn-login-insta');
    btn.innerText = "Conectando...";
    btn.disabled = true;

    setTimeout(() => {
        handleAuth(userInput);
        closeInstaModal();
        btn.innerText = "Entrar";
        btn.disabled = false;
    }, 1500);
}

// --- AUTENTICAÇÃO ---
async function handleAuth(usernameRaw) {
    const username = usernameRaw.toLowerCase().replace(/\s/g, '').replace('@', '');

    try {
        const userRef = db.collection('users').doc(username);
        const doc = await userRef.get();

        if (doc.exists) {
            // Entra na conta existente
            loginUser(doc.data());
        } else {
            // Cria conta nova
            // Usa avatar de iniciais por padrão (mais garantido que não quebra)
            const defaultAvatar = `https://ui-avatars.com/api/?name=${username}&background=000&color=fff&size=256&bold=true`;
            
            const newUser = {
                username: username,
                avatar: defaultAvatar,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await userRef.set(newUser);
            loginUser(newUser);
        }
    } catch (error) {
        console.error("Erro Auth:", error);
        alert("Erro ao conectar ao servidor.");
    }
}

function loginUser(userData) {
    currentUser = userData;
    localStorage.setItem('anonbox_user', JSON.stringify(userData));
    setupDashboard();
    showScreen('dashboard');
}

// --- DASHBOARD E EDIÇÃO DE PERFIL ---
function setupDashboard() {
    document.getElementById('user-name').innerText = "@" + currentUser.username;
    
    const img = document.getElementById('user-avatar');
    img.src = currentUser.avatar;
    
    // Adiciona evento de clique para MUDAR A FOTO
    img.style.cursor = "pointer";
    img.title = "Clique para alterar a foto";
    img.onclick = changeProfilePic; // Função nova

    // Se quebrar, volta para iniciais
    img.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=000&color=fff&bold=true`;
    };
    
    // Configura link
    // Ajuste para funcionar na Netlify ou Local
    const baseUrl = window.location.href.split('?')[0];
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    document.getElementById('my-link').value = `${cleanUrl}?u=${currentUser.username}`;
    
    listenToMessages();
}

// --- NOVA FUNÇÃO: TROCAR FOTO ---
async function changeProfilePic() {
    const newUrl = prompt("Personalize seu perfil:\nCole o link (URL) de uma imagem (JPG/PNG):", currentUser.avatar);
    
    if (newUrl && newUrl.trim() !== "") {
        try {
            // Atualiza no Banco de Dados
            await db.collection('users').doc(currentUser.username).update({
                avatar: newUrl
            });
            
            // Atualiza na tela
            currentUser.avatar = newUrl;
            document.getElementById('user-avatar').src = newUrl;
            localStorage.setItem('anonbox_user', JSON.stringify(currentUser));
            
            alert("Foto atualizada com sucesso!");
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar a foto.");
        }
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('anonbox_user');
    if (realTimeListener) realTimeListener();
    
    // Limpa campos
    document.getElementById('insta-user').value = "";
    document.getElementById('insta-pass').value = "";
    
    showScreen('login');
}

// --- MENSAGENS ---
function listenToMessages() {
    const container = document.getElementById('messages-list');
    if (realTimeListener) realTimeListener();

    realTimeListener = db.collection("messages")
        .where("to", "==", currentUser.username)
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            container.innerHTML = "";
            if (snapshot.empty) {
                container.innerHTML = '<p class="empty-state">Nenhuma mensagem ainda.</p>';
                return;
            }
            snapshot.forEach(doc => {
                createMessageCard(doc.data().text, container);
            });
        }, error => console.log(error));
}

function createMessageCard(text, container) {
    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerText = text;
    container.appendChild(card);
}

function copyLink() {
    const copyText = document.getElementById("my-link");
    copyText.select();
    document.execCommand("copy");
    alert("Link copiado! Coloque no seu Stories.");
}

// --- VISITANTE ---
function simulateVisitorView() {
    loadPublicProfile(currentUser.username, currentUser.avatar);
}

function loadPublicProfile(username, avatar) {
    document.getElementById('public-header').innerText = `Mande algo anônimo para @${username}`;
    
    const img = document.getElementById('public-avatar');
    img.src = avatar;
    img.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${username}&background=000&color=fff&bold=true`;
    };

    document.getElementById('public-screen').dataset.toUser = username;
    document.getElementById('question-input').value = "";
    showScreen('public');
}

function sendQuestion() {
    const text = document.getElementById('question-input').value;
    const toUser = document.getElementById('public-screen').dataset.toUser;
    
    if (!text.trim()) return alert("Escreva algo!");

    const btn = document.querySelector('.btn-send');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    db.collection("messages").add({
        to: toUser,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Enviado! 🚀");
        document.getElementById('question-input').value = "";
        if (currentUser && currentUser.username === toUser) {
            showScreen('dashboard');
        }
    })
    .catch((err) => console.error(err))
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "Enviar Anônimo 🚀";
    });
}

function rollDice() {
    const input = document.getElementById('question-input');
    input.value = diceQuestions[Math.floor(Math.random() * diceQuestions.length)];
}

function goToHome() {
    // Limpa URL
    const baseUrl = window.location.href.split('?')[0];
    window.history.pushState({}, document.title, baseUrl);
    showScreen('login');
}

// --- INICIALIZAÇÃO ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('u');
    
    if (userParam) {
        // Modo Visitante: Tenta buscar dados do usuário no banco para pegar a foto certa
        db.collection('users').doc(userParam).get().then(doc => {
            let avatar = `https://ui-avatars.com/api/?name=${userParam}&background=000&color=fff&bold=true`;
            if (doc.exists && doc.data().avatar) {
                avatar = doc.data().avatar;
            }
            loadPublicProfile(userParam, avatar);
        });
    } else {
        // Verifica login salvo
        const saved = localStorage.getItem('anonbox_user');
        if (saved) {
            loginUser(JSON.parse(saved));
        } else {
            showScreen('login');
        }
    }
};