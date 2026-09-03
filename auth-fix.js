/* Correção do login Firebase - Abridor de Processos */
(function () {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBCol6rLWUGIVvjBoaub9lv6eazYqnmOK0',
    authDomain: 'abridor-de-processos.firebaseapp.com',
    projectId: 'abridor-de-processos',
    storageBucket: 'abridor-de-processos.firebasestorage.app',
    messagingSenderId: '955966759369',
    appId: '1:955966759369:web:781d4413800b7229820818',
    measurementId: 'G-L3RX6R9KST'
  };

  function friendlyError(error) {
    const code = error && error.code ? error.code : '';
    const messages = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'Não encontramos uma conta com este e-mail.',
      'auth/invalid-email': 'Digite um e-mail válido.',
      'auth/operation-not-allowed': 'O login por e-mail e senha ainda não está ativado no Firebase.',
      'auth/unauthorized-domain': 'Este endereço do site não está autorizado no Firebase. Adicione souzarlk.github.io em Domínios autorizados.',
      'auth/network-request-failed': 'Não foi possível conectar ao Firebase. Verifique sua internet e tente novamente.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      'auth/invalid-api-key': 'A chave do Firebase está inválida ou foi restringida.',
      'auth/email-already-in-use': 'Este e-mail já possui uma conta. Use a opção Entrar.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/password-does-not-meet-requirements': 'A senha não atende aos requisitos definidos no Firebase.',
      'auth/internal-error': 'O Firebase retornou um erro interno. Tente novamente.'
    };
    return messages[code] || (error && error.message) || 'Não foi possível concluir a operação.';
  }

  function init() {
    const originalForm = document.getElementById('authForm');
    if (!originalForm) return;

    // Remove listeners do script antigo e assume o controle do formulário.
    const form = originalForm.cloneNode(true);
    originalForm.replaceWith(form);

    const msg = document.getElementById('msg');
    const subtitle = document.getElementById('subtitle');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const resetBtn = document.getElementById('resetBtn');

    function show(text, ok) {
      if (!msg) return;
      msg.textContent = text;
      msg.classList.toggle('ok', !!ok);
    }

    function busy(button, text) {
      if (!button) return;
      button.disabled = true;
      button.style.opacity = '.7';
      const span = button.querySelector('span');
      if (span) span.textContent = text;
    }

    function ready(button, text) {
      if (!button) return;
      button.disabled = false;
      button.style.opacity = '';
      const span = button.querySelector('span');
      if (span) span.textContent = text;
    }

    // Abas Entrar / Criar conta
    form.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        form.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        form.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(tab.dataset.panel);
        if (panel) panel.classList.add('active');
        const register = tab.dataset.panel === 'registerPanel';
        if (subtitle) subtitle.textContent = register
          ? 'Crie sua conta para acessar o sistema.'
          : 'Entre com seu e-mail e senha para acessar o sistema.';
        show('', false);
      });
    });

    // Mostrar/ocultar senha
    form.querySelectorAll('.eye').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.target);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.setAttribute('aria-label', input.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
      });
    });

    // Carrega Firebase somente depois que o formulário está pronto.
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js')
      .then(async ({ initializeApp }) => {
        const authModule = await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js');
        const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } = authModule;
        const auth = getAuth(initializeApp(FIREBASE_CONFIG));

        form.addEventListener('submit', async event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          const email = document.getElementById('loginEmail').value.trim();
          const password = document.getElementById('loginPassword').value;
          show('', false);
          busy(loginBtn, 'Entrando...');
          try {
            await signInWithEmailAndPassword(auth, email, password);
            show('Login realizado! Abrindo o sistema...', true);
            window.location.replace('inicio.html');
          } catch (error) {
            console.error('[Abridor de Processos] Login:', error);
            show(friendlyError(error), false);
            ready(loginBtn, 'Entrar no sistema →');
          }
        }, true);

        registerBtn.addEventListener('click', async () => {
          const name = document.getElementById('registerName').value.trim();
          const email = document.getElementById('registerEmail').value.trim();
          const password = document.getElementById('registerPassword').value;
          const confirm = document.getElementById('registerConfirm').value;
          show('', false);
          if (!name) return show('Digite seu nome completo.');
          if (password.length < 6) return show('A senha precisa ter pelo menos 6 caracteres.');
          if (password !== confirm) return show('As senhas não coincidem.');
          busy(registerBtn, 'Criando conta...');
          try {
            const credential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(credential.user, { displayName: name });
            show('Conta criada com sucesso! Abrindo o sistema...', true);
            window.location.replace('inicio.html');
          } catch (error) {
            console.error('[Abridor de Processos] Cadastro:', error);
            show(friendlyError(error), false);
            ready(registerBtn, 'Criar minha conta →');
          }
        });

        resetBtn.addEventListener('click', async () => {
          const email = document.getElementById('loginEmail').value.trim();
          if (!email) return show('Digite seu e-mail antes de solicitar a recuperação da senha.');
          busy(resetBtn, 'Enviando...');
          try {
            await sendPasswordResetEmail(auth, email);
            show('Enviamos as instruções de recuperação para seu e-mail.', true);
          } catch (error) {
            console.error('[Abridor de Processos] Recuperação:', error);
            show(friendlyError(error), false);
          } finally {
            resetBtn.disabled = false;
            resetBtn.style.opacity = '';
            resetBtn.textContent = 'Esqueci minha senha';
          }
        });
      })
      .catch(error => {
        console.error('[Abridor de Processos] Firebase SDK:', error);
        show('Não foi possível carregar o serviço de autenticação. Atualize a página e tente novamente.', false);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
