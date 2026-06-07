/**
 * project.ts — Página de detalhe do projeto.
 *
 * Abas: Tarefas | Membros | Convites (Líder)
 * CRUD de tarefas, gerência de membros, envio de convites.
 */
import { ProjetoAPI, TarefaAPI, MembroAPI, ConviteAPI } from "./api.js";
import { requireAuth, loadSidebar, showAlert, clearAlert, openModal, closeModal, bindModalClose, setLoading, formatDate, getQueryParam, iniciais, } from "./auth.js";
requireAuth();
// ── Estado ────────────────────────────────────────────────────────────────
const projetoId = Number(getQueryParam("id"));
if (!projetoId)
    window.location.href = "dashboard.html";
let projeto = null;
let tarefas = [];
let membros = [];
let convites = [];
let isLider = false;
let currentUsername = "";
// ── Bootstrap ─────────────────────────────────────────────────────────────
(async () => {
    const perfil = await loadSidebar("dashboard");
    currentUsername = perfil?.username ?? "";
    try {
        projeto = await ProjetoAPI.detalhar(projetoId);
        isLider = projeto.meu_papel === "Líder";
        renderHeader();
        await Promise.all([loadTarefas(), loadMembros()]);
        if (isLider)
            await loadConvites();
        setupUI();
    }
    catch (err) {
        document.getElementById("project-body").innerHTML =
            `<div class="alert alert-error">${err.message}</div>`;
    }
})();
// ── Header ────────────────────────────────────────────────────────────────
function renderHeader() {
    if (!projeto)
        return;
    const papel = projeto.meu_papel ?? "—";
    const badgeClass = isLider ? "badge-gold" : "badge-blue";
    document.getElementById("project-name").textContent = projeto.nome;
    document.getElementById("project-desc").textContent = projeto.descricao;
    document.getElementById("project-badge").innerHTML =
        `<span class="badge ${badgeClass}">${papel}</span>`;
    document.getElementById("project-meta").innerHTML =
        `<span class="text-xs text-muted font-mono">Criado por ${projeto.criado_por.username} · ${formatDate(projeto.criado_em)}</span>`;
    // Botões de ação do líder
    const actionsEl = document.getElementById("project-actions");
    if (isLider) {
        actionsEl.innerHTML = `
      <button id="btn-edit-project" class="btn btn-secondary btn-sm">✏️ Editar</button>
      <button id="btn-delete-project" class="btn btn-danger btn-sm">🗑 Excluir</button>`;
        document.getElementById("btn-edit-project")?.addEventListener("click", openEditProject);
        document.getElementById("btn-delete-project")?.addEventListener("click", confirmDeleteProject);
    }
    // Mostra aba de convites só para líderes
    const tabConvites = document.getElementById("tab-convites");
    if (tabConvites)
        tabConvites.classList.toggle("hidden", !isLider);
}
// ── Tarefas ───────────────────────────────────────────────────────────────
async function loadTarefas() {
    const el = document.getElementById("tarefas-list");
    el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    tarefas = await TarefaAPI.listar(projetoId);
    renderTarefas();
}
function renderTarefas() {
    const el = document.getElementById("tarefas-list");
    document.getElementById("tarefas-count").textContent = String(tarefas.length);
    // Atualiza select de responsável no modal de tarefa
    updateResponsavelSelect();
    if (!tarefas.length) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>Nenhuma tarefa ainda</h3>
        <p>${isLider ? "Crie a primeira tarefa do projeto." : "O líder ainda não criou tarefas."}</p>
      </div>`;
        return;
    }
    // Agrupa por status
    const groups = { P: [], E: [], C: [] };
    tarefas.forEach((t) => groups[t.status].push(t));
    const statusLabels = { P: "Pendente", E: "Em andamento", C: "Concluída" };
    el.innerHTML = Object.entries(groups)
        .filter(([, list]) => list.length > 0)
        .map(([status, list]) => `
      <div style="margin-bottom:24px">
        <h4 style="font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-3);margin-bottom:12px;font-family:var(--font-m)">${statusLabels[status]} <span style="color:var(--text-4)">(${list.length})</span></h4>
        ${list.map(renderTarefaItem).join("")}
      </div>`)
        .join("");
    el.querySelectorAll(".task-item").forEach((item) => {
        item.addEventListener("click", (e) => {
            const target = e.target;
            if (target.closest("button"))
                return;
            const id = Number(item.dataset["id"]);
            window.location.href = `/task.html?projeto=${projetoId}&id=${id}`;
        });
    });
}
function renderTarefaItem(t) {
    const prazoHtml = t.prazo
        ? `<span>📅 ${formatDate(t.prazo)}</span>`
        : "";
    const respHtml = t.responsavel
        ? `<span>👤 ${t.responsavel.username}</span>`
        : "";
    const editBtn = isLider
        ? `<button class="btn btn-icon btn-ghost btn-sm btn-edit-tarefa" data-id="${t.id}" title="Editar">✏️</button>
       <button class="btn btn-icon btn-ghost btn-sm btn-del-tarefa" data-id="${t.id}" title="Excluir">🗑</button>`
        : "";
    return `
    <div class="task-item" data-id="${t.id}" style="cursor:pointer">
      <div class="task-status-dot ${t.status}"></div>
      <div style="flex:1;min-width:0">
        <div class="task-title">${escHtml(t.titulo)}</div>
        <div class="task-meta">
          ${prazoHtml}${respHtml}
          <span>💬 ${t.total_observacoes}</span>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">${editBtn}</div>
    </div>`;
}
// ── Membros ───────────────────────────────────────────────────────────────
async function loadMembros() {
    const el = document.getElementById("membros-list");
    el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    membros = await MembroAPI.listar(projetoId);
    renderMembros();
}
function renderMembros() {
    const el = document.getElementById("membros-list");
    document.getElementById("membros-count").textContent = String(membros.length);
    if (!membros.length) {
        el.innerHTML = `<div class="empty-state"><h3>Nenhum membro</h3></div>`;
        return;
    }
    el.innerHTML = membros
        .map((m) => {
        const isMe = m.usuario.username === currentUsername;
        const canRemove = isLider && !isMe && m.papel !== "L";
        const removeBtn = canRemove
            ? `<button class="btn btn-sm btn-danger btn-remove-member" data-id="${m.id}" data-name="${m.usuario.username}">Remover</button>`
            : "";
        const badgeClass = m.papel === "L" ? "badge-gold" : "badge-blue";
        return `
        <div class="member-row">
          <div class="member-info">
            <div class="member-avatar">${iniciais(m.usuario.nome_completo)}</div>
            <div>
              <div class="member-name">${escHtml(m.usuario.nome_completo)}</div>
              <div class="member-username">@${m.usuario.username}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="badge ${badgeClass}">${m.papel_display}</span>
            ${removeBtn}
          </div>
        </div>`;
    })
        .join("");
    // Bind remoção
    el.querySelectorAll(".btn-remove-member").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (confirm(`Remover @${btn.dataset["name"]} do projeto?`)) {
                removeMembro(Number(btn.dataset["id"]), btn);
            }
        });
    });
}
async function removeMembro(id, btn) {
    setLoading(btn, true, "Remover");
    try {
        await MembroAPI.remover(projetoId, id);
        await loadMembros();
        updateResponsavelSelect();
    }
    catch (err) {
        alert(err.message);
    }
    finally {
        setLoading(btn, false, "Remover");
    }
}
// ── Convites ──────────────────────────────────────────────────────────────
async function loadConvites() {
    const el = document.getElementById("convites-list");
    if (!el)
        return;
    el.innerHTML = `<div class="loading-center"><span class="spinner"></span></div>`;
    convites = await ConviteAPI.doprojeto(projetoId);
    renderConvites();
}
function renderConvites() {
    const el = document.getElementById("convites-list");
    if (!el)
        return;
    document.getElementById("convites-count").textContent =
        String(convites.filter((c) => c.status === "P").length);
    if (!convites.length) {
        el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📨</div>
        <h3>Nenhum convite enviado</h3>
        <p>Convide membros usando o formulário acima.</p>
      </div>`;
        return;
    }
    const statusColor = {
        P: "badge-orange", A: "badge-green", R: "badge-red",
    };
    el.innerHTML = convites
        .map((c) => `
      <div class="member-row">
        <div class="member-info">
          <div class="member-avatar">${iniciais(c.convidado.nome_completo)}</div>
          <div>
            <div class="member-name">${escHtml(c.convidado.nome_completo)}</div>
            <div class="member-username">@${c.convidado.username}</div>
          </div>
        </div>
        <span class="badge ${statusColor[c.status] ?? "badge-gray"}">${c.status_display}</span>
      </div>`)
        .join("");
}
// ── Setup botões e modais ─────────────────────────────────────────────────
function setupUI() {
    // ── Botão nova tarefa (só líder) ────────────────────────
    const btnNewTask = document.getElementById("btn-new-task");
    if (btnNewTask) {
        btnNewTask.classList.toggle("hidden", !isLider);
        btnNewTask.addEventListener("click", () => {
            resetTarefaModal();
            document.getElementById("tarefa-modal-title").textContent = "Nova Tarefa";
            openModal("modal-tarefa");
        });
    }
    // ── Formulário de tarefa ────────────────────────────────
    const formTarefa = document.getElementById("form-tarefa");
    const btnSaveTarefa = document.getElementById("btn-save-tarefa");
    formTarefa.addEventListener("submit", (e) => { e.preventDefault(); saveTarefa(btnSaveTarefa); });
    document.getElementById("btn-close-tarefa")?.addEventListener("click", () => closeModal("modal-tarefa"));
    bindModalClose("modal-tarefa");
    // ── Edit/Delete tarefa via event delegation ─────────────
    document.getElementById("tarefas-list")?.addEventListener("click", (e) => {
        const target = e.target;
        const editBtn = target.closest(".btn-edit-tarefa");
        const delBtn = target.closest(".btn-del-tarefa");
        if (editBtn) {
            e.stopPropagation();
            openEditTarefa(Number(editBtn.dataset["id"]));
        }
        if (delBtn) {
            e.stopPropagation();
            confirmDeleteTarefa(Number(delBtn.dataset["id"]));
        }
    });
    // ── Editar projeto ──────────────────────────────────────
    const formEdit = document.getElementById("form-edit-project");
    const btnSaveEdit = document.getElementById("btn-save-edit");
    formEdit?.addEventListener("submit", (e) => { e.preventDefault(); saveEditProject(btnSaveEdit); });
    document.getElementById("btn-close-edit")?.addEventListener("click", () => closeModal("modal-edit-project"));
    bindModalClose("modal-edit-project");
    // ── Convidar membro ─────────────────────────────────────
    const formInvite = document.getElementById("form-invite");
    const btnInvite = document.getElementById("btn-send-invite");
    formInvite?.addEventListener("submit", (e) => { e.preventDefault(); sendInvite(btnInvite); });
}
// ── Tarefa CRUD ───────────────────────────────────────────────────────────
let editingTarefaId = null;
function resetTarefaModal() {
    editingTarefaId = null;
    document.getElementById("form-tarefa").reset();
    clearAlert("alert-tarefa");
}
function updateResponsavelSelect() {
    const sel = document.getElementById("tarefa-responsavel");
    if (!sel)
        return;
    const prevVal = sel.value;
    sel.innerHTML = `<option value="">— Sem responsável —</option>` +
        membros.map((m) => `<option value="${m.usuario.id}">${escHtml(m.usuario.nome_completo)} (@${m.usuario.username})</option>`).join("");
    sel.value = prevVal;
}
function openEditTarefa(id) {
    const tarefa = tarefas.find((t) => t.id === id);
    if (!tarefa)
        return;
    editingTarefaId = id;
    document.getElementById("tarefa-titulo").value = tarefa.titulo;
    document.getElementById("tarefa-descricao").value = tarefa.descricao;
    document.getElementById("tarefa-status").value = tarefa.status;
    document.getElementById("tarefa-prazo").value = tarefa.prazo ?? "";
    document.getElementById("tarefa-responsavel").value =
        String(tarefa.responsavel?.id ?? "");
    document.getElementById("tarefa-modal-title").textContent = "Editar Tarefa";
    clearAlert("alert-tarefa");
    openModal("modal-tarefa");
}
async function saveTarefa(btn) {
    const titulo = document.getElementById("tarefa-titulo").value.trim();
    const descricao = document.getElementById("tarefa-descricao").value.trim();
    const status = document.getElementById("tarefa-status").value;
    const prazo = document.getElementById("tarefa-prazo").value || null;
    const respIdStr = document.getElementById("tarefa-responsavel").value;
    const responsavel_id = respIdStr ? Number(respIdStr) : null;
    if (!titulo || !descricao) {
        showAlert("alert-tarefa", "Título e descrição são obrigatórios.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        const payload = { titulo, descricao, status, prazo, responsavel_id };
        if (editingTarefaId) {
            await TarefaAPI.atualizar(projetoId, editingTarefaId, payload);
        }
        else {
            await TarefaAPI.criar(projetoId, payload);
        }
        closeModal("modal-tarefa");
        await loadTarefas();
    }
    catch (err) {
        showAlert("alert-tarefa", err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
}
async function confirmDeleteTarefa(id) {
    const tarefa = tarefas.find((t) => t.id === id);
    if (!tarefa)
        return;
    if (!confirm(`Excluir tarefa "${tarefa.titulo}"? Esta ação não pode ser desfeita.`))
        return;
    try {
        await TarefaAPI.excluir(projetoId, id);
        await loadTarefas();
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Projeto Edit / Delete ─────────────────────────────────────────────────
function openEditProject() {
    if (!projeto)
        return;
    document.getElementById("edit-nome").value = projeto.nome;
    document.getElementById("edit-descricao").value = projeto.descricao;
    clearAlert("alert-edit-project");
    openModal("modal-edit-project");
}
async function saveEditProject(btn) {
    const nome = document.getElementById("edit-nome").value.trim();
    const descricao = document.getElementById("edit-descricao").value.trim();
    if (!nome || !descricao) {
        showAlert("alert-edit-project", "Preencha todos os campos.");
        return;
    }
    setLoading(btn, true, "Salvar");
    try {
        projeto = await ProjetoAPI.atualizar(projetoId, { nome, descricao });
        closeModal("modal-edit-project");
        renderHeader();
    }
    catch (err) {
        showAlert("alert-edit-project", err.message);
    }
    finally {
        setLoading(btn, false, "Salvar");
    }
}
async function confirmDeleteProject() {
    if (!confirm(`Excluir o projeto "${projeto?.nome}"? Todos os dados serão perdidos.`))
        return;
    try {
        await ProjetoAPI.excluir(projetoId);
        window.location.href = "dashboard.html";
    }
    catch (err) {
        alert(err.message);
    }
}
// ── Convidar membro ───────────────────────────────────────────────────────
async function sendInvite(btn) {
    const username = document.getElementById("invite-username").value.trim();
    if (!username) {
        showAlert("alert-invite", "Informe o username.");
        return;
    }
    setLoading(btn, true, "Convidar");
    try {
        await ConviteAPI.enviar(projetoId, username);
        document.getElementById("invite-username").value = "";
        showAlert("alert-invite", `Convite enviado para @${username}!`, "success");
        await loadConvites();
    }
    catch (err) {
        showAlert("alert-invite", err.message);
    }
    finally {
        setLoading(btn, false, "Convidar");
    }
}
// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
        const tab = t.dataset["tab"];
        document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((x) => x.classList.remove("active"));
        t.classList.add("active");
        document.querySelector(`.tab-content[data-content="${tab}"]`)?.classList.add("active");
    });
});
// ── Utilitário ────────────────────────────────────────────────────────────
function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
