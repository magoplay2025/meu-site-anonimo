// --- CONFIGURAÇÃO FIREBASE ---
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
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- VARIÁVEIS GLOBAIS ---
let currentUser = null;
let realTimeListener = null;

const screens = {
    login: document.getElementById('login-screen'),
    dashboard: document.getElementById('dashboard-screen'),
    public: document.getElementById('public-screen')
};

// Perguntas do dado
const diceQuestions = [
    "Qual é o seu maior segredo?", 
    "Quem foi seu primeiro crush?", 
    "Uma música que define sua vida?", 
    "O que você faria com 1 milhão?",
    "Uma viagem dos sonhos?",
    "Me conte algo que ninguém sabe..."
];

// --- NAVEGAÇÃO ENTRE TELAS ---
function showScreen(screenName) {
    Object.values(screens).forEach(s => { 
        s.classList.remove('active'); 
        s.classList.add('hidden'); 
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

// --- LOGIN / CADASTRO (COM SENHA PRÓPRIA) ---
async function handleLogin() {
    const userInp = document.getElementById('inp-user').value.toLowerCase().replace(/\s/g, '').replace('@', '');
    const passInp = document.getElementById('inp-pass').value;

    if (!userInp || !passInp) return alert("Preencha usuário e senha.");
    if (passInp.length < 3) return alert("A senha deve ter pelo menos 3 caracteres.");

    const btn = document.querySelector('.btn-black');
    const originalText = btn.innerText;
    btn.innerText = "Carregando...";
    btn.disabled = true;

    try {
        const userRef = db.collection('users').doc(userInp);
        const doc = await userRef.get();

        if (doc.exists) {
            // LOGIN: Usuário existe, verifica a senha (PIN)
            const data = doc.data();
            if (data.pin === passInp) {
                loginUser(data);
            } else {
                alert("Senha incorreta! Se você criou essa conta, use a senha definida no cadastro.");
            }
        } else {
            // CADASTRO: Usuário não existe, cria novo
            const confirmCreate = confirm(`O usuário @${userInp} ainda não existe.\nDeseja criar uma conta agora com essa senha?`);
            
            if (confirmCreate) {
                const newUser = {
                    username: userInp,
                    pin: passInp, // Essa senha será a oficial
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await userRef.set(newUser);
                loginUser(newUser);
            }
        }
    } catch (e) {
        console.error(e);
        alert("Erro de conexão com o servidor.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function loginUser(userData) {
    currentUser = userData;
    // Salva no navegador para não pedir senha toda hora
    localStorage.setItem('anonbox_user', JSON.stringify(userData));
    setupDashboard();
    showScreen('dashboard');
}

// --- DASHBOARD (PAINEL DO USUÁRIO) ---
function setupDashboard() {
    document.getElementById('user-name').innerText = "@" + currentUser.username;
    
    // Configura Avatar (Letra Padrão)
    const avatarUrl = `https://ui-avatars.com/api/?name=${currentUser.username}&background=random&color=fff&bold=true&size=200`;
    document.getElementById('user-avatar').src = avatarUrl;
    
    // Configura o Link de Compartilhamento
    const baseUrl = window.location.href.split('?')[0];
    const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    document.getElementById('my-link').value = `${cleanUrl}?u=${currentUser.username}`;
    
    // Começa a ouvir mensagens
    listenToMessages();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('anonbox_user');
    if (realTimeListener) realTimeListener();
    document.getElementById('inp-pass').value = ""; // Limpa senha por segurança
    showScreen('login');
}

// --- MENSAGENS E BOTÃO DE RESPONDER ---
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
    
    // Texto da pergunta
    const textElem = document.createElement('div');
    textElem.className = 'msg-text';
    textElem.innerText = text;
    
    // Botão de Responder (Chama a função mágica)
    const btn = document.createElement('button');
    btn.className = 'btn-reply';
    btn.innerHTML = '<span class="material-icons">photo_camera</span> Responder no Story';
    btn.onclick = () => generateStoryImage(text, btn);

    card.appendChild(textElem);
    card.appendChild(btn);
    container.appendChild(card);
}

// --- FUNÇÃO MÁGICA: GERAR IMAGEM E COMPARTILHAR ---
function generateStoryImage(text, btnElement) {
    // 1. Preenche o template escondido com o texto da pergunta
    const storyText = document.getElementById('story-text');
    storyText.innerText = text;

    const element = document.getElementById('story-capture');
    const originalText = btnElement.innerHTML;
    
    // Feedback visual
    btnElement.innerHTML = "Gerando...";
    btnElement.disabled = true;

    // 2. Usa html2canvas para tirar o print
    html2canvas(element, {
        scale: 2, // Qualidade 2x (HD)
        useCORS: true, // Permite carregar fontes externas
        backgroundColor: null
    }).then(canvas => {
        // Transforma o 'print' em um arquivo de imagem (Blob)
        canvas.toBlob(blob => {
            const file = new File([blob], "story_anonimo.png", { type: "image/png" });

            // 3. Tenta usar o Compartilhamento Nativo do Celular (Web Share API)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'Responder no Instagram',
                    text: 'Recebi essa pergunta no Anon.io!'
                })
                .then(() => console.log('Compartilhado!'))
                .catch((error) => console.log('Erro ao compartilhar (ou cancelado)', error));
            } else {
                // 4. FALLBACK: Se for PC ou celular antigo, faz o download normal
                const link = document.createElement('a');
                link.download = `story_${currentUser.username}.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                alert("Imagem salva na galeria! Abra o Instagram e poste no Story.");
            }

            // Restaura o botão
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }, 'image/png');
    }).catch(err => {
        console.error(err);
        alert("Erro ao gerar imagem. Tente novamente.");
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    });
}

function copyLink() {
    const copyText = document.getElementById("my-link");
    copyText.select();
    document.execCommand("copy");
    alert("Link copiado! Coloque no sticker do Instagram.");
}

// --- MODO VISITANTE (PÚBLICO) ---
function simulateVisitorView() {
    const username = currentUser.username;
    // Usa avatar padrão de letra
    const avatarUrl = `https://ui-avatars.com/api/?name=${username}&background=random&color=fff&bold=true&size=200`;
    loadPublicProfile(username, avatarUrl);
}

function loadPublicProfile(username, avatar) {
    document.getElementById('public-header').innerText = `Envie para @${username}`;
    document.getElementById('public-avatar').src = avatar;
    document.getElementById('public-screen').dataset.toUser = username;
    document.getElementById('question-input').value = "";
    showScreen('public');
}

function sendQuestion() {
    const text = document.getElementById('question-input').value;
    const toUser = document.getElementById('public-screen').dataset.toUser;
    
    if (!text.trim()) return alert("Escreva algo antes de enviar!");

    const btn = document.querySelector('.btn-send');
    btn.disabled = true; 
    btn.innerText = "Enviando...";

    db.collection("messages").add({
        to: toUser,
        text: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("Enviado com sucesso! 🚀");
        document.getElementById('question-input').value = "";
        
        // Se for o dono testando, volta pro painel
        if (currentUser && currentUser.username === toUser) {
            showScreen('dashboard');
        }
    })
    .catch((err) => {
        console.error(err);
        alert("Erro ao enviar.");
    })
    .finally(() => { 
        btn.disabled = false; 
        btn.innerText = "Enviar 🚀"; 
    });
}

function rollDice() {
    const input = document.getElementById('question-input');
    input.value = diceQuestions[Math.floor(Math.random() * diceQuestions.length)];
}

function goToHome() {
    const baseUrl = window.location.href.split('?')[0];
    window.history.pushState({}, document.title, baseUrl);
    showScreen('login');
}

// --- INICIALIZAÇÃO DO SITE ---
window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('u');
    
    if (userParam) {
        // MODO VISITANTE (Alguém clicou no link)
        const avatarUrl = `https://ui-avatars.com/api/?name=${userParam}&background=random&color=fff&bold=true&size=200`;
        loadPublicProfile(userParam, avatarUrl);
    } else {
        // MODO DONO (Verifica se já estava logado)
        const saved = localStorage.getItem('anonbox_user');
        if (saved) {
            loginUser(JSON.parse(saved));
        } else {
            showScreen('login');
        }
    }
};