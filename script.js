
let token = sessionStorage.getItem("token");  
let donors = [];                               

const $ = id => document.getElementById(id);  

function esc(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
}

async function api(url, data) {
    const options = { headers: { "X-Token": token } };
    if (data) {
        options.method = "POST";
        options.body = new URLSearchParams(data);
    }
    const res = await fetch(url, options);
    const result = await res.json();
    if (res.status === 401) {          // login expired
        logout();
        throw new Error("login");
    }
    if (result.error) {
        alert(result.error);
        throw new Error(result.error);
    }
    return result;
}

async function login() {
    const res = await fetch("/api/login", {
        method: "POST",
        body: new URLSearchParams({ username: $("username").value, password: $("password").value })
    });
    const result = await res.json();
    if (result.error) {
        alert(result.error);
        return;
    }
    token = result.token;
    sessionStorage.setItem("token", token);
    startApp();
}

function logout() {
    sessionStorage.removeItem("token");
    location.reload();
}

async function startApp() {
    $("loginBox").style.display = "none";
    $("app").style.display = "block";
    await loadGroups();
    showPage("dashboard");
}


function showPage(name) {
    document.querySelectorAll(".page").forEach(p => p.style.display = "none");
    $("page-" + name).style.display = "block";

    if (name === "dashboard") loadDashboard();
    if (name === "donors") loadDonors();
    if (name === "stock") loadStock();
    if (name === "requests") loadRequests();
}

async function loadGroups() {
    const groups = await api("/api/groups");
    let options = "";
    groups.forEach(g => options += `<option value="${g.group_id}">${esc(g.group_name)}</option>`);
    $("donorGroup").innerHTML = options;
    $("reqGroup").innerHTML = options;
    $("filterGroup").innerHTML = '<option value="">All groups</option>' + options;
}

async function loadDashboard() {
    const stock = await api("/api/stock");
    const requests = await api("/api/requests");

    let totalUnits = 0, totalDonors = 0, rows = "";
    stock.forEach(s => {
        totalUnits += s.units;
        totalDonors += s.active_donors;
        const level = s.units < 5 ? "<span class='low'>Low</span>" : "OK";
        rows += `<tr><td>${esc(s.group_name)}</td><td>${s.units}</td><td>${s.active_donors}</td><td>${level}</td></tr>`;
    });

    $("reportRows").innerHTML = rows;
    $("totalUnits").textContent = totalUnits;
    $("totalDonors").textContent = totalDonors;
    $("pendingCount").textContent = requests.filter(r => r.status === "Pending").length;
}


async function loadDonors() {
    const url = "/api/donors?group_id=" + $("filterGroup").value + "&search=" + encodeURIComponent($("search").value);
    donors = await api(url);

    let rows = "";
    donors.forEach(d => {
        const newStatus = d.status === "Active" ? "Inactive" : "Active";
        rows += `<tr>
            <td>${esc(d.name)}</td>
            <td>${esc(d.group_name)}</td>
            <td>${d.age}</td>
            <td>${esc(d.phone)}</td>
            <td>${esc(d.city)}</td>
            <td>${d.last_donation || "-"}</td>
            <td class="${d.status === "Inactive" ? "inactive" : ""}">${d.status}</td>
            <td>
                <button onclick="editDonor(${d.donor_id})">Edit</button>
                <button class="grey" onclick="setDonorStatus(${d.donor_id}, '${newStatus}')">Make ${newStatus}</button>
                <button onclick="deleteDonor(${d.donor_id})">Delete</button>
            </td></tr>`;
    });
    $("donorRows").innerHTML = rows || "<tr><td colspan='8'>No donors found</td></tr>";
}


async function saveDonor() {
    const data = {
        name: $("dName").value,
        age: $("dAge").value,
        gender: $("dGender").value,
        phone: $("dPhone").value,
        city: $("dCity").value,
        group_id: $("donorGroup").value,
        last_donation: $("dLast").value
    };
    if ($("donorId").value) {
        data.donor_id = $("donorId").value;
        await api("/api/donors/update", data);
    } else {
        await api("/api/donors", data);
    }
    alert("Donor saved!");
    clearDonorForm();
    showPage("donors");
}

function editDonor(id) {
    const d = donors.find(x => x.donor_id === id);
    showPage("register");
    $("donorTitle").textContent = "Edit Donor";
    $("donorId").value = d.donor_id;
    $("dName").value = d.name;
    $("dAge").value = d.age;
    $("dGender").value = d.gender;
    $("dPhone").value = d.phone;
    $("dCity").value = d.city || "";
    $("donorGroup").value = d.group_id;
    $("dLast").value = d.last_donation || "";
}

function clearDonorForm() {
    $("donorTitle").textContent = "Register Donor";
    ["donorId", "dName", "dAge", "dPhone", "dCity", "dLast"].forEach(id => $(id).value = "");
}

async function setDonorStatus(id, status) {
    await api("/api/donors/status", { donor_id: id, status: status });
    loadDonors();
}

async function deleteDonor(id) {
    if (!confirm("Delete this donor?")) return;
    await api("/api/donors/delete", { donor_id: id });
    loadDonors();
}

async function loadStock() {
    const stock = await api("/api/stock");
    let rows = "";
    stock.forEach(s => {
        rows += `<tr>
            <td>${esc(s.group_name)}</td>
            <td>${s.units}</td>
            <td>
                <input type="number" class="amt" id="amt${s.group_id}" value="1" min="1">
                <button onclick="changeStock(${s.group_id}, 1)">Add</button>
                <button class="grey" onclick="changeStock(${s.group_id}, -1)">Remove</button>
            </td></tr>`;
    });
    $("stockRows").innerHTML = rows;
}

async function changeStock(groupId, sign) {
    const amount = Number($("amt" + groupId).value);
    if (!amount || amount < 1) {
        alert("Enter a number 1 or more");
        return;
    }
    await api("/api/stock/change", { group_id: groupId, change: amount * sign });
    loadStock();
}

async function addGroup() {
    await api("/api/groups", { group_name: $("newGroup").value });
    $("newGroup").value = "";
    await loadGroups();
    loadStock();
}


async function loadRequests() {
    const requests = await api("/api/requests");
    let rows = "";
    requests.forEach(r => {
        let buttons = "";
        if (r.status === "Pending") {
            buttons = `<button onclick="setRequestStatus(${r.request_id}, 'Fulfilled')">Fulfil</button>
                       <button class="grey" onclick="setRequestStatus(${r.request_id}, 'Rejected')">Reject</button>`;
        }
        rows += `<tr>
            <td>${esc(r.patient_name)}</td>
            <td>${esc(r.hospital)}</td>
            <td>${esc(r.group_name)}</td>
            <td>${r.units}</td>
            <td>${r.request_date}</td>
            <td>${r.status}</td>
            <td>${buttons}</td></tr>`;
    });
    $("requestRows").innerHTML = rows || "<tr><td colspan='7'>No requests yet</td></tr>";
}

async function saveRequest() {
    await api("/api/requests", {
        patient_name: $("rPatient").value,
        hospital: $("rHospital").value,
        group_id: $("reqGroup").value,
        units: $("rUnits").value
    });
    ["rPatient", "rHospital", "rUnits"].forEach(id => $(id).value = "");
    loadRequests();
}

async function setRequestStatus(id, status) {
    await api("/api/requests/status", { request_id: id, status: status });
    loadRequests();
}

if (token) startApp(); 
