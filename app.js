const signupBtn = document.getElementById("signupBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginStatus = document.getElementById("loginStatus");
const authDiv = document.getElementById("auth");

let data = { students: [] };
let userLoggedIn = false;

let expanded = {
  studentIndex: null,
  subjectIndex: null
};


// ---------- AUTH ----------
document.addEventListener("DOMContentLoaded", () => {
  const email = document.getElementById("email");
  const password = document.getElementById("password");

  signupBtn.onclick = () =>
    auth.createUserWithEmailAndPassword(email.value, password.value)
      .catch(e => alert(e.message));

  loginBtn.onclick = () =>
    auth.signInWithEmailAndPassword(email.value, password.value)
      .catch(e => alert(e.message));

  logoutBtn.onclick = () => auth.signOut();
});

auth.onAuthStateChanged(user => {
  if (user) {
    userLoggedIn = true;
    loginStatus.textContent = `Logged in as ${user.email}`;
    authDiv.style.display = "none";
    logoutBtn.style.display = "inline-block";
    loadFromCloud();
  } else {
    userLoggedIn = false;
    loginStatus.textContent = "Not logged in (local mode)";
    authDiv.style.display = "block";
    logoutBtn.style.display = "none";
    loadLocal();
  }
});

// ---------- SAVE / LOAD ----------
function save() {
  userLoggedIn ? saveToCloud() : saveLocal();
}

function saveLocal() {
  localStorage.setItem("gradebook", JSON.stringify(data));
}

function loadLocal() {
  const s = localStorage.getItem("gradebook");
  if (s) {
    data = JSON.parse(s);
  } else {
    data = { students: [] };
  }
  render();
}

function saveToCloud() {
  db.collection("users")
    .doc(auth.currentUser.uid)
    .set({ gradebook: data });
}

function loadFromCloud() {
  db.collection("users")
    .doc(auth.currentUser.uid)
    .get()
    .then(d => {
      if (d.exists) data = d.data().gradebook;
      else saveToCloud();
      render();
    });
}

// ---------- GRADEBOOK ----------
function addStudent() {
  const name = prompt("Student name");
  if (!name) return;
  data.students.push({
    name,
    years: [{
      year: new Date().getFullYear(),
      subjects: []
    }]
  });
  save();
  render();
}

function addSubject(studentIndex) {
  const name = prompt("Subject name");
  if (!name) return;

  data.students[studentIndex].years[0].subjects.push({
    name,
    weights: {
      Homework: 30,
      Quiz: 30,
      Test: 40
    },
    semesters: { S1: [], S2: [] }
  });

  save();
  render();
}

function addAssignment(studentIndex, subjectIndex) {
  const title = prompt("Assignment title");
  if (!title) return;

  const type = prompt("Assignment type (Homework, Quiz, Test)", "Homework");

  const due = prompt("Due date (YYYY-MM-DD)\nLeave blank if none");
  const scoreInput = prompt("Score (optional)");
  const maxInput = prompt("Max points (optional)");

  data.students[studentIndex]
    .years[0]
    .subjects[subjectIndex]
    .semesters.S1.push({
      name: title,
      type: type || "Homework",
      score: Number(scoreInput) || 0,
      max: Number(maxInput) || 0,
      due: due || null
    });

  save();
  render();
}

function average(assignments) {
  let earned = 0, possible = 0;
  assignments.forEach(a => {
    earned += a.score;
    possible += a.max;
  });
  return possible ? Math.round((earned / possible) * 100) : 0;
}

// ---------- UI ----------
function render() {
  renderUpcoming();

const el = document.getElementById("students");
  el.innerHTML = "";

  data.students.forEach((student, si) => {
    const studentDiv = document.createElement("div");
    studentDiv.className = "student-card";

    studentDiv.innerHTML = `
      <h2>${student.name}</h2>
      <button class="secondary" onclick="addSubject(${si})">
        ➕ Add Subject
      </button>
    `;

    student.years[0].subjects.forEach((subject, subi) => {
      const avg = weightedAverage(
  subject.semesters.S1,
  subject.weights
);

	const nextDue = nextDueDate(subject.semesters.S1);


      const subjectDiv = document.createElement("div");
      subjectDiv.className = "subject-row";

      subjectDiv.innerHTML = `
  <div>
    <strong>${subject.name}</strong>
    ${nextDue ? `<div style="font-size:0.8rem;color:#555;">Due ${nextDue}</div>` : ""}
  </div>
  <span class="badge">${avg}%</span>
`;

const weightBtn = document.createElement("button");
weightBtn.className = "secondary";
weightBtn.textContent = "⚖️ Edit Weights";
weightBtn.onclick = (e) => {
  e.stopPropagation();
  editWeights(si, subi);
};

studentDiv.appendChild(weightBtn);

      subjectDiv.onclick = () => {
  if (
    expanded.studentIndex === si &&
    expanded.subjectIndex === subi
  ) {
    expanded.studentIndex = null;
    expanded.subjectIndex = null;
  } else {
    expanded.studentIndex = si;
    expanded.subjectIndex = subi;
  }
  render();
};


const isExpanded =
  expanded.studentIndex === si &&
  expanded.subjectIndex === subi;

if (isExpanded) {
  const assignmentsDiv = document.createElement("div");
  assignmentsDiv.style.paddingLeft = "1rem";
  assignmentsDiv.innerHTML = `
   ${renderAssignments(subject.semesters.S1, si, subi)}
    <button class="secondary" onclick="addAssignment(${si}, ${subi})">
      ➕ Add Assignment
    </button>
  `;
  studentDiv.appendChild(assignmentsDiv);
}

      const importBtn = document.createElement("button");
      importBtn.textContent = "📥 Import CSV";
      importBtn.className = "secondary";
      importBtn.onclick = (e) => {
        e.stopPropagation();
        importCSV(si, subi);
      };

      studentDiv.appendChild(subjectDiv);
      studentDiv.appendChild(importBtn);
    });

    el.appendChild(studentDiv);
  });
}

// ---------- CALENDAR ----------
function showCalendar() {
  alert("Calendar feature coming next iteration");
}



//----------CSV Import------------
function importCSV(studentIndex, subjectIndex) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      parseCSV(
        reader.result,
        studentIndex,
        subjectIndex
      );
    };
    reader.readAsText(file);
  };

  input.click();
}

function parseCSV(text, studentIndex, subjectIndex) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    alert("CSV must have a header and at least one row");
    return;
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
const dueIndex = headers.indexOf("due");

  const titleIndex = headers.indexOf("title");
  const scoreIndex = headers.indexOf("score");
  const maxIndex = headers.indexOf("max");

  if (titleIndex === -1) {
    alert("CSV must include a 'title' column");
    return;
  }

  const assignments =
    data.students[studentIndex]
      .years[0]
      .subjects[subjectIndex]
      .semesters.S1;

  lines.slice(1).forEach(line => {
    const cols = line.split(",");

    const title = cols[titleIndex]?.trim();
    if (!title) return;

    assignments.push({
  name: title,
  type: "Homework", 
  score: scoreIndex !== -1 ? Number(cols[scoreIndex]) || 0 : 0,
  max: maxIndex !== -1 ? Number(cols[maxIndex]) || 0 : 0,
  due: dueIndex !== -1 ? cols[dueIndex]?.trim() || null : null
});

  });

  save();
  render();
}

function nextDueDate(assignments) {
  const today = new Date().toISOString().split("T")[0];

  const upcoming = assignments
    .filter(a => a.due && a.due >= today)
    .sort((a, b) => a.due.localeCompare(b.due));

  return upcoming.length ? upcoming[0].due : null;
}

function getUpcomingAssignments() {
  const today = new Date().toISOString().split("T")[0];
  const weekAhead = new Date(Date.now() + 7 * 86400000)
    .toISOString()
    .split("T")[0];

  const upcoming = [];

  data.students.forEach(student => {
    student.years[0].subjects.forEach(subject => {
      subject.semesters.S1.forEach(assignment => {
        if (assignment.due && assignment.due >= today && assignment.due <= weekAhead) {
          upcoming.push({
            student: student.name,
            subject: subject.name,
            title: assignment.name,
            due: assignment.due
          });
        }
      });
    });
  });

  return upcoming.sort((a, b) => a.due.localeCompare(b.due));
}

function renderUpcoming() {
  const el = document.getElementById("upcoming");
  el.innerHTML = "";

  const upcoming = getUpcomingAssignments();

  if (upcoming.length === 0) {
    el.innerHTML = `
      <div class="student-card">
        <strong>Upcoming</strong>
        <p style="margin:0.5rem 0;">No assignments due this week 🎉</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="student-card">
      <strong>Upcoming This Week</strong>
  `;

  upcoming.forEach(a => {
    html += `
      <div style="padding:0.5rem 0;border-bottom:1px solid #eee;">
        <div><strong>${a.title}</strong></div>
        <div style="font-size:0.85rem;color:#555;">
          ${a.student} • ${a.subject} • Due ${a.due}
        </div>
      </div>
    `;
  });

  html += `</div>`;
  el.innerHTML = html;
}

function renderAssignments(assignments, si, subi) {
  if (!assignments.length) {
    return `<div style="font-size:0.9rem;color:#666;">No assignments yet</div>`;
  }

  return assignments.map((a, ai) => `
    <div class="assignment-row">
      <input
        class="inline-input"
        value="${a.name}"
        placeholder="Assignment title"
        onchange="updateAssignmentField(${si},${subi},${ai},'name', this.value)"
      />

      <input
        type="date"
        class="inline-input small"
        value="${a.due || ""}"
        onchange="updateAssignmentField(${si},${subi},${ai},'due', this.value)"
      />


<select
  class="inline-input small"
  onchange="updateAssignmentField(${si},${subi},${ai},'type', this.value)"
>
  ${renderTypeOptions(a.type)}
</select>
      
<input
        type="number"
        class="inline-input tiny"
        placeholder="Score"
        value="${a.score || ""}"
        onchange="updateAssignmentField(${si},${subi},${ai},'score', this.value)"
      />

      <input
        type="number"
        class="inline-input tiny"
        placeholder="Max"
        value="${a.max || ""}"
        onchange="updateAssignmentField(${si},${subi},${ai},'max', this.value)"
      />

      <button
        class="secondary"
        onclick="deleteAssignment(${si},${subi},${ai})"
      >🗑️</button>
    </div>
  `).join("");
}

function renderTypeOptions(current) {
  const types = ["Homework", "Quiz", "Test", "Project"];
  return types.map(t =>
    `<option value="${t}" ${t === current ? "selected" : ""}>${t}</option>`
  ).join("");
}

function weightedAverage(assignments, weights) {
  let total = 0;
  let usedWeight = 0;

  Object.keys(weights).forEach(type => {
    const group = assignments.filter(a => a.type === type && a.max > 0);

    if (!group.length) return;

    let earned = 0;
    let possible = 0;

    group.forEach(a => {
      earned += a.score;
      possible += a.max;
    });

    const percent = earned / possible;
    total += percent * weights[type];
    usedWeight += weights[type];
  });

  return usedWeight ? Math.round(total / usedWeight) : 0;
}

function updateAssignmentField(studentIndex, subjectIndex, assignmentIndex, field, value) {
  const assignment =
    data.students[studentIndex]
      .years[0]
      .subjects[subjectIndex]
      .semesters.S1[assignmentIndex];

  if (field === "score" || field === "max") {
    assignment[field] = Number(value) || 0;
  } else {
    assignment[field] = value || null;
  }

  save();
  render();
}


function editAssignment(studentIndex, subjectIndex, assignmentIndex) {
  const a =
    data.students[studentIndex]
      .years[0]
      .subjects[subjectIndex]
      .semesters.S1[assignmentIndex];

  const name = prompt("Assignment name", a.name);
  if (!name) return;

  const due = prompt("Due date (YYYY-MM-DD)", a.due || "");
  const scoreInput = prompt("Score", a.score);
  const maxInput = prompt("Max points", a.max);

  a.name = name;
  a.due = due || null;
  a.score = Number(scoreInput) || 0;
  a.max = Number(maxInput) || 0;

  save();
  render();
}

function deleteAssignment(studentIndex, subjectIndex, assignmentIndex) {
  const confirmed = confirm("Delete this assignment?");
  if (!confirmed) return;

  data.students[studentIndex]
    .years[0]
    .subjects[subjectIndex]
    .semesters.S1.splice(assignmentIndex, 1);

  save();
  render();
}

function editWeights(studentIndex, subjectIndex) {
  const subject =
    data.students[studentIndex]
      .years[0]
      .subjects[subjectIndex];

  Object.keys(subject.weights).forEach(type => {
    const val = prompt(
      `Weight for ${type} (%)`,
      subject.weights[type]
    );
    if (val !== null) subject.weights[type] = Number(val) || 0;
  });

  save();
  render();
}

