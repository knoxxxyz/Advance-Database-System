const SK = { user: 'st2_user', auth: 'st2_auth' };
const BASE_API = '';
const ld = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const sv = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const auth = ld(SK.auth, null);
if (auth) {
  if (auth.role === 'admin') {
    window.location.href = 'admin-dashboard.html';
  } else {
    window.location.href = 'index.html';
  }
}

function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('loginPanel').classList.toggle('active', isLogin);
  document.getElementById('registerPanel').classList.toggle('active', !isLogin);
  document.getElementById('switchText').innerHTML = isLogin
    ? `Don't have an account? <a href="#" onclick="switchTab('register')">Create a new account now</a>`
    : `Already have an account? <a href="#" onclick="switchTab('login')">Sign in here</a>`;
}

function togglePw(id, btn) {
  const inp = document.getElementById(id);
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  const role = document.querySelector('input[name="authRole"]:checked')?.value || 'user';

  if (!email || !pass) {
    alert('⚠️ Please fill in all fields');
    return;
  }

  try {
    const response = await fetch(`${BASE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, role }),
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.message || 'Login failed.');
      return;
    }

    const { user } = await response.json();
    sv(SK.user, { id: user.id, name: user.name, email: user.email });
    sv(SK.auth, { role: user.role });
    window.location.href = user.role === 'admin' ? 'admin-dashboard.html' : 'index.html';
  } catch (err) {
    console.error(err);
    alert('Unable to connect to the backend. Make sure the server is running.');
  }
}

async function register() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPassword').value;
  const conf = document.getElementById('regConfirm').value;

  if (!name || !email || !pass || !conf) {
    alert('⚠️ Please fill in all fields');
    return;
  }
  if (!email.includes('@')) {
    alert('⚠️ Enter a valid email');
    return;
  }
  if (pass !== conf) {
    alert('⚠️ Passwords do not match');
    return;
  }
  if (pass.length < 6) {
    alert('⚠️ Password must be at least 6 characters');
    return;
  }

  try {
    const response = await fetch(`${BASE_API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: pass }),
    });

    if (!response.ok) {
      const error = await response.json();
      alert(error.message || 'Registration failed.');
      return;
    }

    const { user } = await response.json();
    sv(SK.user, { id: user.id, name: user.name, email: user.email });
    sv(SK.auth, { role: user.role });
    window.location.href = 'index.html';
  } catch (err) {
    console.error(err);
    alert('Unable to connect to the backend. Make sure the server is running.');
  }
}
