// --- CONFIGURAÇÃO DO FIREBASE (MANTENHA SUAS CHAVES) ---
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
    console.error("ERRO: Firebase não carregou.");
} else {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// --- VARIÁVEIS ---
let currentUser = null;
let realTimeListener = null;

// Avatar padrão (caso a foto real falhe)
const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    public: document.getElementById('public-screen')
};

const diceQuestions = [
    "Qual é o seu maior segredo?", 
    "Quem foi seu primeiro crush?", 
    "O que você faria se ganhasse na loteria?", 
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

// --- MODAL DE LOGIN ---
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
    btn.innerText = "Verificando...";
    btn.disabled = true;

    // Simula tempo de verificação
    setTimeout(() => {
        handleAuth(userInput);
        closeInstaModal();
        btn.innerText = "Entrar";
        btn.disabled = false;
    }, 1500);
}

// --- AUTENTICAÇÃO ---
async function handleAuth(usernameRaw) {
    // Limpa o nome do usuário
    const username = usernameRaw.toLowerCase().replace(/\s/g, '').replace('@', '');

    try {
        const userRef = db.collection('users').doc(username);
        const doc = await userRef.get();

        // Tenta pegar a FOTO REAL usando o serviço unavatar.io
        // Se falhar, usaremos as iniciais como fallback
        const realAvatarUrl = `https://unavatar.io/instagram/${username}`;
        
        let userData;

        if (doc.exists) {
            // Usuário já existe, atualizamos a foto para tentar pegar a real
            userData = doc.data();
            userData.avatar = realAvatarUrl; 
            await userRef.update({ avatar: realAvatarUrl });
        } else {
            // Cria novo usuário
            userData = {
                username: username,
                avatar: realAvatarUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            await userRef.set(userData);
        }

        loginUser(userData);

    } catch (error) {
        console.error("Erro Auth:", error);
        alert("Erro ao conectar.");
    }
}

function loginUser(userData) {
    currentUser = userData;
    
    // --- SALVAR CONTA (PERSISTÊNCIA) ---
    // Salva os dados no navegador para não precisar logar de novo
    localStorage.setItem('anonbox_user', JSON.stringify(userData));
    
    setupDashboard();
    showScreen('dashboard');
}

function setupDashboard() {
    document.getElementById('user-name').innerText = "@" + currentUser.username;
    
    const img = document.getElementById('user-avatar');
    img.src = currentUser.avatar;
    
    // TRUQUE DA FOTO:
    // Se a foto do Instagram falhar (bloqueio), coloca as iniciais coloridas
    img.onerror = function() {
        this.onerror = null; // Evita loop infinito
        this.src = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random&color=fff&size=200`;
    };
    
    const currentUrl = window.location.href.split('?')[0];
    document.getElementById('my-link').value = `${currentUrl}?u=${currentUser.username}`;
    
    listenToMessages();
}

function logout() {
    currentUser = null;
    
    // Limpa o salvamento automático ao sair
    localStorage.removeItem('anonbox_user');
    
    if (realTimeListener) realTimeListener();
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
        });
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
    alert("Link copiado!");
}

// --- VISITANTE ---
function simulateVisitorView() {
    loadPublicProfile(currentUser.username, currentUser.avatar);
}

function loadPublicProfile(username, avatar) {
    document.getElementById('public-header').innerText = `Mande algo anônimo para @${username}`;
    
    const img = document.getElementById('public-avatar');
    img.src = avatar;
    
    // Fallback também na tela pública
    img.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${username}&background=random&color=fff&size=200`;
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
    window.history.pushState({}, document.title, window.location.pathname);
    showScreen('login');
}

// --- INICIALIZAÇÃO (VERIFICA SE JÁ ESTÁ LOGADO) ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('u');
    
    if (userParam) {
        // Se tem ?u=usuario na URL, é modo visitante
        const fakeAvatar = `https://unavatar.io/instagram/${userParam}`;
        loadPublicProfile(userParam, fakeAvatar);
    } else {
        // Se não tem nada na URL, verifica se já tem conta salva
        const saved = localStorage.getItem('anonbox_user');
        if (saved) {
            // SE ACHAR SALVO, ENTRA DIRETO
            loginUser(JSON.parse(saved));
        } else {
            showScreen('login');
        }
    }
};