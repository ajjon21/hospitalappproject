const state = {
  user: null,
  patients: [],
  rooms: [],
  users: [],
};

function showFeedback(selector, message, isError = true) {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = message;
  node.style.color = isError ? '#dc2626' : '#16a34a';
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || 'Request failed');
  }
  return response.json();
}

async function handleLogin(event) {
  event.preventDefault();
  showFeedback('#login-feedback', '');
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  try {
    const result = await requestJson('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    window.location.href = result.redirect || '/dashboard';
  } catch (err) {
    showFeedback('#login-feedback', err.message);
  }
}

async function loadProfile() {
  try {
    const response = await requestJson('/api/profile');
    state.user = response.user;
    document.querySelector('#user-role').textContent = `${state.user.name} · ${state.user.role.toUpperCase()}`;
    if (state.user.role === 'admin') {
      document.querySelector('#admin-panel').hidden = false;
      fetchUsers();
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchPatients() {
  const response = await requestJson('/api/patients');
  state.patients = response.patients;
  renderPatients();
}

async function fetchRooms() {
  const response = await requestJson('/api/rooms');
  state.rooms = response.rooms;
  renderRooms();
  renderRoomOptions();
}

async function fetchUsers() {
  try {
    const response = await requestJson('/api/users');
    state.users = response.users;
    renderUsers();
  } catch (err) {
    console.error(err);
  }
}

function renderPatients() {
  const tableBody = document.querySelector('#patients-table tbody');
  if (!tableBody) return;
  tableBody.innerHTML = state.patients
    .map((patient) => {
      const assignedRoom = patient.assignedRoomId ? `Room ${patient.assignedRoomId}` : 'Unassigned';
      return `
        <tr>
          <td>${patient.fullName}</td>
          <td>${patient.age}</td>
          <td>${patient.conditionStatus}</td>
          <td>${patient.infectionRisk}</td>
          <td>${patient.isolationPriority}</td>
          <td>${assignedRoom}</td>
          <td>
            <button class="ghost" onclick="removePatient('${patient.id}')">Remove</button>
          </td>
        </tr>
      `;
    })
    .join('');
  document.querySelector('#metric-patients').textContent = state.patients.length;
}

function renderRooms() {
  const tableBody = document.querySelector('#rooms-table tbody');
  if (!tableBody) return;
  const availableRooms = state.rooms.filter((room) => room.status === 'available').length;
  const criticalIsolationCount = state.patients.filter((patient) => patient.isolationPriority === 'Critical Isolation').length;

  document.querySelector('#metric-available-rooms').textContent = availableRooms;
  document.querySelector('#metric-critical').textContent = criticalIsolationCount;

  tableBody.innerHTML = state.rooms
    .map((room) => {
      const status = room.status === 'available' ? 'Available' : 'Occupied';
      const patientName = room.assignedPatientName || 'None';
      const action = room.status === 'occupied'
        ? `<button class="ghost" onclick="releaseRoom(${room.id})">Release</button>`
        : `<button class="ghost" onclick="assignRoom(${room.id})">Assign</button>`;
      return `
        <tr>
          <td>${room.roomNumber}</td>
          <td>${room.type}</td>
          <td>${status}</td>
          <td>${room.isolation ? 'Yes' : 'No'}</td>
          <td>${patientName}</td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join('');
}

function renderRoomOptions() {
  const select = document.querySelector('#assignedRoomId');
  if (!select) return;
  select.innerHTML = '<option value="">No room assigned</option>' +
    state.rooms
      .filter((room) => room.status === 'available')
      .map((room) => `<option value="${room.id}">${room.roomNumber} (${room.type})</option>`)
      .join('');
}

function renderUsers() {
  const tableBody = document.querySelector('#users-table tbody');
  if (!tableBody) return;
  tableBody.innerHTML = state.users
    .map((user) => `
      <tr>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.createdAt).toLocaleDateString()}</td>
      </tr>
    `)
    .join('');
}

async function handlePatientForm(event) {
  event.preventDefault();
  showFeedback('#patient-feedback', '');
  const form = event.target;
  const payload = {
    fullName: form.fullName.value.trim(),
    age: Number(form.age.value),
    conditionStatus: form.conditionStatus.value,
    infectionRisk: form.infectionRisk.value,
    notes: form.notes.value.trim(),
    assignedRoomId: form.assignedRoomId.value || undefined,
  };
  try {
    await requestJson('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    form.reset();
    fetchPatients();
    fetchRooms();
    showFeedback('#patient-feedback', 'Patient created successfully.', false);
  } catch (err) {
    showFeedback('#patient-feedback', err.message);
  }
}

async function handleUserForm(event) {
  event.preventDefault();
  showFeedback('#user-feedback', '');
  const form = event.target;
  const payload = {
    name: form.userName.value.trim(),
    email: form.userEmail.value.trim(),
    role: form.userRole.value,
    password: form.userPassword.value,
  };
  try {
    await requestJson('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    form.reset();
    fetchUsers();
    showFeedback('#user-feedback', 'User created successfully.', false);
  } catch (err) {
    showFeedback('#user-feedback', err.message);
  }
}

async function removePatient(id) {
  if (!confirm('Remove this patient record and release assigned room?')) {
    return;
  }
  try {
    await requestJson(`/api/patients/${id}`, { method: 'DELETE' });
    fetchPatients();
    fetchRooms();
  } catch (err) {
    alert(err.message);
  }
}

async function releaseRoom(id) {
  try {
    await requestJson(`/api/rooms/${id}/release`, { method: 'PUT' });
    fetchPatients();
    fetchRooms();
  } catch (err) {
    alert(err.message);
  }
}

async function assignRoom(roomId) {
  const unassignedPatients = state.patients.filter((patient) => !patient.assignedRoomId);
  if (!unassignedPatients.length) {
    alert('No unassigned patients are available to assign.');
    return;
  }

  const options = unassignedPatients
    .map((patient, index) => `${index + 1}. ${patient.fullName} (${patient.age}, ${patient.infectionRisk})`)
    .join('\n');
  const choice = prompt(`Choose a patient to assign to room ${roomId}:\n${options}`);
  const selectedIndex = Number(choice) - 1;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= unassignedPatients.length) {
    return;
  }

  const patientId = unassignedPatients[selectedIndex].id;
  try {
    await requestJson(`/api/rooms/${roomId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    });
    fetchPatients();
    fetchRooms();
  } catch (err) {
    alert(err.message);
  }
}

async function logout() {
  await requestJson('/api/logout', { method: 'POST' });
  window.location.href = '/login';
}

function setupDashboard() {
  document.querySelector('#logout-button').addEventListener('click', logout);
  document.querySelector('#patient-form').addEventListener('submit', handlePatientForm);
  document.querySelector('#user-form')?.addEventListener('submit', handleUserForm);
  loadProfile();
  fetchPatients();
  fetchRooms();
}

function setupLogin() {
  document.querySelector('#login-form').addEventListener('submit', handleLogin);
}

if (document.body.dataset.page === 'dashboard') {
  setupDashboard();
} else if (document.body.dataset.page === 'login') {
  setupLogin();
}
