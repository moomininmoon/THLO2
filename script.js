/* =========================================================
   TANHA LAW OFFICE — script.js (Multi-page)
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore, collection, addDoc, getDoc, getDocs, query, orderBy, where,
    deleteDoc, doc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* ---------- Firebase ---------- */
const firebaseConfig = {
    apiKey: "AIzaSyCzcdf8QBZFTtKh6vTM2f_Awb9Vncb3EtU",
    authDomain: "tanhalaw-e5d06.firebaseapp.com",
    projectId: "tanhalaw-e5d06",
    storageBucket: "tanhalaw-e5d06.appspot.com",
    messagingSenderId: "882787510142",
    appId: "1:882787510142:web:36f4b2342ed9a2dfcd752f"
};
const ADMIN_EMAIL = "tanhalaw1@gmail.com";

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

/* ---------- Helpers ---------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function escapeHTML(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function nl2br(str = "") {
    return escapeHTML(str).replace(/\n/g, "<br>");
}
function normalizePhone(str = "") {
    return String(str).replace(/[^0-9]/g, "");
}
function generateReceiptNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return `TH-${yyyy}${mm}${dd}-${rand}`;
}
function formatDate(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return "—";
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}
function formatDateOnly(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}.${mm}.${dd}`;
}

/* 현재 페이지 식별 */
function getPageName() {
    return document.body.dataset.page || "";
}

/* URL 쿼리 파라미터 가져오기 */
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

/* ---------- Modal ---------- */
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}
function closeAllModals() {
    $$(".modal.is-open").forEach(m => closeModal(m.id));
}

/* ---------- Auth state (모든 페이지 공통) ---------- */
let currentUserIsAdmin = false;

onAuthStateChanged(auth, (user) => {
    const isAdmin = !!(user && user.email === ADMIN_EMAIL);
    currentUserIsAdmin = isAdmin;

    const authMenu     = $("#auth-menu");
    const adminMenu    = $("#admin-menu");
    const adminSection = $("#admin-only-section");

    if (authMenu) {
        authMenu.innerHTML = isAdmin
            ? `<a href="#" data-action="logout">Logout</a>`
            : `<a href="#" data-action="open-login">Login</a>`;
    }
    if (adminMenu) adminMenu.hidden = !isAdmin;
    if (adminSection) adminSection.hidden = !isAdmin;

    // 페이지별로 인증 상태가 영향을 주는 부분 갱신
    const page = getPageName();
    if (page === "cases") {
        loadCasesList();
    } else if (page === "case-detail") {
        // 상세 페이지의 삭제 버튼 노출 갱신
        const delWrap = $("#case-detail-delete");
        if (delWrap) delWrap.hidden = !isAdmin;
    }
});

/* ---------- Consultation form (consultation 페이지) ---------- */
function initConsultationForm() {
    const consultForm = $("#consultation-form");
    if (!consultForm) return;

    consultForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = consultForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;

        const name    = $("#user-name").value.trim();
        const phone   = $("#user-phone").value.trim();
        const email   = $("#user-email").value.trim();
        const type    = $("#consult-type").value;
        const message = $("#user-message").value.trim();
        const agreed  = $("#privacy-check").checked;

        if (!name || !phone || !email || !message) {
            alert("모든 필수 항목을 입력해주세요.");
            return;
        }
        if (!agreed) {
            alert("개인정보 수집 및 이용에 동의해주세요.");
            return;
        }

        btn.disabled = true;
        btn.textContent = "접수 중";

        try {
            const receiptNumber = generateReceiptNumber();
            const phoneNormalized = normalizePhone(phone);

            await addDoc(collection(db, "consultations"), {
                name, phone, phoneNormalized, email, type, message,
                receiptNumber,
                done: false,
                timestamp: serverTimestamp()
            });

            consultForm.reset();

            const numEl = $("#receipt-number");
            if (numEl) numEl.textContent = receiptNumber;
            openModal("receipt-modal");
        } catch (err) {
            console.error(err);
            alert("접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

/* ---------- Cases list (cases 페이지) ---------- */
async function loadCasesList() {
    const list = $("#cases-list");
    if (!list) return;

    try {
        const q = query(collection(db, "cases"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `<div class="cases-empty">아직 등록된 사례가 없습니다.</div>`;
            return;
        }

        const html = [];

        snap.forEach((docSnap) => {
            const d  = docSnap.data();
            const id = docSnap.id;

            const imgHtml = d.imageUrl
                ? `<img src="${escapeHTML(d.imageUrl)}" alt="${escapeHTML(d.title || '')}" class="case-img" loading="lazy">`
                : `<div class="case-img-empty">TANHA</div>`;

            const dateHtml = d.timestamp
                ? `<span class="case-date">${escapeHTML(formatDateOnly(d.timestamp))}</span>`
                : "";

            const delHtml = currentUserIsAdmin
                ? `<div class="case-actions">
                       <button class="delete-btn" data-action="delete-case" data-id="${escapeHTML(id)}">삭제</button>
                   </div>`
                : "";

            // 본문 미리보기 (공백/줄바꿈 정리)
            const excerpt = String(d.content || "").replace(/\s+/g, " ").trim();

            const caseUrl = `case-detail.html?id=${encodeURIComponent(id)}`;

            html.push(`
                <article class="case-card" data-href="${escapeHTML(caseUrl)}" role="link" tabindex="0">
                    ${delHtml}
                    ${imgHtml}
                    <div class="case-body">
                        ${dateHtml}
                        <h3>${escapeHTML(d.title || "(제목 없음)")}</h3>
                        <p class="case-excerpt">${escapeHTML(excerpt)}</p>
                        <span class="case-readmore">자세히 보기 <span aria-hidden="true">→</span></span>
                    </div>
                </article>
            `);
        });

        list.innerHTML = html.join("");
    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class="cases-empty">사례를 불러오는 데 실패했습니다.</div>`;
    }
}

async function deleteCase(id) {
    if (!id) return;
    if (!confirm("이 사례를 삭제하시겠습니까?")) return;
    try {
        await deleteDoc(doc(db, "cases", id));
        await loadCasesList();
    } catch (err) {
        console.error(err);
        alert("삭제에 실패했습니다.");
    }
}

/* ---------- Case detail (case-detail 페이지) ---------- */
async function loadCaseDetail() {
    const wrap = $("#case-detail");
    if (!wrap) return;

    const id = getQueryParam("id");
    if (!id) {
        wrap.innerHTML = `
            <div class="case-detail-error">
                잘못된 접근입니다.<a href="cases.html">성공사례 목록으로 →</a>
            </div>`;
        return;
    }

    try {
        const snap = await getDoc(doc(db, "cases", id));
        if (!snap.exists()) {
            wrap.innerHTML = `
                <div class="case-detail-error">
                    존재하지 않거나 삭제된 사례입니다.<a href="cases.html">성공사례 목록으로 →</a>
                </div>`;
            return;
        }

        const d = snap.data();
        const title = escapeHTML(d.title || "(제목 없음)");
        const dateStr = d.timestamp ? formatDateOnly(d.timestamp) : "";
        const imgHtml = d.imageUrl
            ? `<div class="case-detail-image">
                   <img src="${escapeHTML(d.imageUrl)}" alt="${title}">
               </div>`
            : "";
        const contentHtml = nl2br(d.content || "");

        // 페이지 타이틀도 갱신
        document.title = `${d.title || "성공 사례"} | 법률사무소 탄하`;

        // 삭제 버튼은 항상 렌더링하고, hidden으로만 노출 제어
        // (auth 상태가 비동기로 들어오므로, 추후 토글 가능하도록)
        wrap.innerHTML = `
            <a href="cases.html" class="case-detail-back">← 목록으로</a>

            <header class="case-detail-header">
                <div class="case-detail-eyebrow">Case</div>
                <h1>${title}</h1>
                ${dateStr ? `<p class="case-detail-date">${escapeHTML(dateStr)}</p>` : ""}
            </header>

            ${imgHtml}

            <div class="case-detail-content">${contentHtml}</div>

            <footer class="case-detail-footer">
                <a href="cases.html" class="case-detail-back">← 목록으로</a>
                <span id="case-detail-delete" ${currentUserIsAdmin ? "" : "hidden"}>
                    <button type="button" class="btn btn-outline" data-action="delete-case-detail" data-id="${escapeHTML(id)}">사례 삭제</button>
                </span>
            </footer>
        `;
    } catch (err) {
        console.error(err);
        wrap.innerHTML = `
            <div class="case-detail-error">
                사례를 불러오는 중 오류가 발생했습니다.<a href="cases.html">성공사례 목록으로 →</a>
            </div>`;
    }
}

async function deleteCaseFromDetail(id) {
    if (!id) return;
    if (!confirm("이 사례를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) return;
    try {
        await deleteDoc(doc(db, "cases", id));
        alert("삭제되었습니다.");
        window.location.href = "cases.html";
    } catch (err) {
        console.error(err);
        alert("삭제에 실패했습니다.");
    }
}

/* ---------- Consultations (admin only) ---------- */
async function loadConsultations() {
    const list  = $("#consults-list");
    const count = $("#consults-count");
    if (!list) return;

    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        list.innerHTML = `<div class="consults-empty">관리자만 조회할 수 있습니다.</div>`;
        if (count) count.textContent = "0";
        return;
    }

    list.innerHTML = `<div class="consults-empty">불러오는 중입니다.</div>`;

    try {
        const q = query(collection(db, "consultations"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);

        if (snap.empty) {
            list.innerHTML = `<div class="consults-empty">접수된 상담이 없습니다.</div>`;
            if (count) count.textContent = "0";
            return;
        }

        if (count) count.textContent = snap.size;

        const html = [];
        snap.forEach((docSnap) => {
            const d  = docSnap.data();
            const id = docSnap.id;

            const name    = escapeHTML(d.name    || "(이름 없음)");
            const phone   = escapeHTML(d.phone   || "");
            const email   = escapeHTML(d.email   || "");
            const type    = escapeHTML(d.type    || "기타");
            const message = escapeHTML(d.message || "");
            const date    = escapeHTML(formatDate(d.timestamp));
            const isDone  = !!d.done;

            const phoneCell = phone
                ? `<a href="tel:${phone.replace(/[^0-9+]/g, '')}">${phone}</a>`
                : "—";
            const emailCell = email
                ? `<a href="mailto:${email}">${email}</a>`
                : "—";

            html.push(`
                <div class="consult-item ${isDone ? 'is-done' : ''}" data-id="${escapeHTML(id)}">
                    <div class="consult-summary" data-action="toggle-consult">
                        <span class="consult-date">${date}</span>
                        <span class="consult-name">${name}</span>
                        <span class="consult-type">${type}</span>
                        <span class="consult-toggle" aria-hidden="true">▾</span>
                    </div>
                    <div class="consult-detail">
                        <dl class="consult-meta">
                            <dt>연락처</dt><dd>${phoneCell}</dd>
                            <dt>이메일</dt><dd>${emailCell}</dd>
                        </dl>
                        <div class="consult-message">${message}</div>
                        <div class="consult-actions">
                            <button class="btn-done ${isDone ? 'is-active' : ''}"
                                    data-action="toggle-done" data-id="${escapeHTML(id)}">
                                ${isDone ? '처리완료 취소' : '처리완료'}
                            </button>
                            <button class="btn-delete"
                                    data-action="delete-consult" data-id="${escapeHTML(id)}">
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            `);
        });

        list.innerHTML = html.join("");
    } catch (err) {
        console.error(err);
        list.innerHTML = `<div class="consults-empty">상담을 불러오는 데 실패했습니다.<br>${escapeHTML(err?.message || '')}</div>`;
    }
}

async function toggleConsultDone(id, currentEl) {
    if (!id) return;
    const isCurrentlyDone = currentEl.classList.contains("is-active");
    try {
        await updateDoc(doc(db, "consultations", id), { done: !isCurrentlyDone });
        await loadConsultations();
    } catch (err) {
        console.error(err);
        alert("상태 변경에 실패했습니다.");
    }
}

async function deleteConsult(id) {
    if (!id) return;
    if (!confirm("이 상담 내역을 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) return;
    try {
        await deleteDoc(doc(db, "consultations", id));
        await loadConsultations();
    } catch (err) {
        console.error(err);
        alert("삭제에 실패했습니다.");
    }
}

/* ---------- My-lookup ---------- */
function initMylookupForm() {
    const mylookupForm = $("#mylookup-form");
    if (!mylookupForm) return;

    mylookupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = mylookupForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        const resultBox = $("#mylookup-result");

        const name  = $("#mylookup-name").value.trim();
        const phone = normalizePhone($("#mylookup-phone").value);

        if (!name || !phone) {
            alert("성함과 연락처를 모두 입력해주세요.");
            return;
        }

        btn.disabled = true;
        btn.textContent = "조회 중";
        if (resultBox) resultBox.innerHTML = "";

        try {
            const q = query(
                collection(db, "consultations"),
                where("name", "==", name),
                where("phoneNormalized", "==", phone)
            );
            const snap = await getDocs(q);

            if (!resultBox) return;

            if (snap.empty) {
                resultBox.innerHTML = `
                    <div class="mylookup-message">
                        일치하는 상담 내역이 없습니다.<br>
                        성함과 연락처를 다시 확인해주세요.
                    </div>`;
                return;
            }

            const items = [];
            snap.forEach(s => items.push({ id: s.id, ...s.data() }));
            items.sort((a, b) => {
                const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return tb - ta;
            });

            const html = items.map(d => {
                const num    = escapeHTML(d.receiptNumber || "(번호 없음)");
                const date   = escapeHTML(formatDate(d.timestamp));
                const type   = escapeHTML(d.type || "기타");
                const msg    = nl2br(d.message || "");
                const isDone = !!d.done;
                const status = isDone ? "처리 완료" : "접수됨";
                const statusCls = isDone ? "is-done" : "";

                return `
                    <article class="mylookup-card">
                        <header class="mylookup-card-head">
                            <span class="mylookup-card-num">${num}</span>
                            <span class="mylookup-card-date">${date}</span>
                            <span class="mylookup-card-status ${statusCls}">${status}</span>
                        </header>
                        <p class="mylookup-card-type">상담 분야 — ${type}</p>
                        <p class="mylookup-card-msg">${msg}</p>
                    </article>
                `;
            }).join("");

            resultBox.innerHTML = html;
        } catch (err) {
            console.error(err);
            if (resultBox) {
                resultBox.innerHTML = `
                    <div class="mylookup-message">
                        조회 중 오류가 발생했습니다.<br>
                        ${escapeHTML(err?.message || '')}
                    </div>`;
            }
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

/* ---------- Post (admin only) ---------- */
function initPostForm() {
    const postForm = $("#post-form");
    if (!postForm) return;

    postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = postForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "업로드 중";

        const file    = $("#post-image")?.files?.[0] || null;
        const title   = $("#post-title-input").value.trim();
        const content = $("#post-content").value.trim();

        if (!title || !content) {
            alert("제목과 내용을 모두 입력해주세요.");
            btn.disabled = false; btn.textContent = originalText;
            return;
        }

        try {
            let imageUrl = null;
            if (file) {
                const safeName = file.name.replace(/[^\w.\-]/g, "_");
                const sRef = ref(storage, `cases/${Date.now()}_${safeName}`);
                await uploadBytes(sRef, file);
                imageUrl = await getDownloadURL(sRef);
            }

            await addDoc(collection(db, "cases"), {
                title, content, imageUrl,
                timestamp: serverTimestamp()
            });

            alert("성공사례가 등록되었습니다.");
            postForm.reset();
            closeModal("post-modal");
            if (getPageName() === "cases") {
                await loadCasesList();
            }
        } catch (err) {
            console.error(err);
            alert("등록에 실패했습니다: " + (err?.message || ""));
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

/* ---------- Login ---------- */
function initLoginForm() {
    const authForm = $("#auth-form");
    if (!authForm) return;

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = authForm.querySelector('button[type="submit"]');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "로그인 중";

        const email    = $("#auth-email").value.trim();
        const password = $("#auth-password").value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            authForm.reset();
            closeModal("login-modal");
        } catch (err) {
            console.error(err);
            alert("로그인에 실패했습니다.");
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

/* ---------- Click delegation (모든 페이지 공통) ---------- */
document.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;

    switch (action) {
        case "open-login":
            e.preventDefault(); openModal("login-modal"); break;
        case "open-post":
            e.preventDefault(); openModal("post-modal"); break;
        case "open-consults":
            e.preventDefault();
            openModal("consults-modal");
            await loadConsultations();
            break;
        case "open-mylookup": {
            e.preventDefault();
            openModal("mylookup-modal");
            $("#mylookup-form")?.reset();
            const r = $("#mylookup-result");
            if (r) r.innerHTML = "";
            break;
        }
        case "close-modal": {
            e.preventDefault();
            const id = target.dataset.target;
            if (id) closeModal(id);
            break;
        }
        case "logout":
            e.preventDefault();
            try { await signOut(auth); alert("로그아웃 되었습니다."); }
            catch (err) { console.error(err); }
            break;
        case "delete-case":
            e.preventDefault();
            e.stopPropagation();
            await deleteCase(target.dataset.id);
            break;
        case "delete-case-detail":
            e.preventDefault();
            await deleteCaseFromDetail(target.dataset.id);
            break;
        case "toggle-consult": {
            const item = target.closest(".consult-item");
            if (item) item.classList.toggle("is-open");
            break;
        }
        case "toggle-done":
            e.preventDefault();
            e.stopPropagation();
            await toggleConsultDone(target.dataset.id, target);
            break;
        case "delete-consult":
            e.preventDefault();
            e.stopPropagation();
            await deleteConsult(target.dataset.id);
            break;
    }
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
});

/* ---------- data-href 카드 네비게이션 ---------- */
document.addEventListener("click", (e) => {
    // 삭제 버튼 등 인터랙티브 요소 클릭 시는 무시
    if (e.target.closest("button, a, [data-action]")) return;
    const card = e.target.closest("[data-href]");
    if (!card) return;
    const url = card.dataset.href;
    if (url) window.location.href = url;
});
document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest("[data-href]");
    if (!card) return;
    if (e.target.closest("button, a, [data-action]")) return;
    const url = card.dataset.href;
    if (url) window.location.href = url;
});

/* ---------- Header scroll state ---------- */
const header = $("#main-header");
let ticking = false;
window.addEventListener("scroll", () => {
    if (ticking) return;
    requestAnimationFrame(() => {
        header?.classList.toggle("scrolled", window.scrollY > 60);
        ticking = false;
    });
    ticking = true;
}, { passive: true });

/* ---------- Mobile nav ---------- */
const navToggle = $(".nav-toggle");
const navLinks  = $(".nav-links");
navToggle?.addEventListener("click", () => {
    navToggle.classList.toggle("is-open");
    navLinks.classList.toggle("is-open");
});
navLinks?.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
        navToggle?.classList.remove("is-open");
        navLinks?.classList.remove("is-open");
    }
});

/* ---------- Reveal on scroll ---------- */
const revealTargets = [
    ".section-header",
    ".page-header",
    ".profile-intro",
    ".profile-content",
    ".form-card",
    ".cases-grid",
    ".contact-list",
    ".home-intro-grid",
    ".case-detail"
];
$$(revealTargets.join(",")).forEach(el => el.classList.add("reveal"));

const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
        }
    });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

$$(".reveal").forEach(el => io.observe(el));

/* ---------- Smooth scroll (홈 내부의 # 링크에만 적용) ---------- */
document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute("href");
    if (href.length <= 1) return;
    // # 만 있고 매칭 element가 없으면 무시
    const t = document.querySelector(href);
    if (!t) return;
    e.preventDefault();
    const headerH = header?.offsetHeight || 76;
    window.scrollTo({
        top: t.getBoundingClientRect().top + window.scrollY - headerH + 1,
        behavior: "smooth"
    });
});

/* ---------- 페이지별 초기화 ---------- */
(function initByPage() {
    const page = getPageName();

    // 모든 페이지 공통
    initLoginForm();

    switch (page) {
        case "home":
            // 홈은 히어로 + 안내 카드만, 추가 init 불필요
            break;
        case "professionals":
            // 정적 페이지
            break;
        case "consultation":
            initConsultationForm();
            initMylookupForm();
            break;
        case "cases":
            initPostForm();
            // 데이터 로드는 onAuthStateChanged에서 호출됨 (Firebase는 비로그인 사용자에 대해서도
            // 초기화 직후 user=null로 콜백을 한 번 호출하므로 여기서 중복 호출하지 않음)
            break;
        case "case-detail":
            loadCaseDetail();
            break;
        case "contact":
            // 정적 페이지
            break;
    }
})();
/* ---------- Video Control ---------- */
const videoElem = $("#main-video");
const videoBtn = $("#video-control-btn");

if (videoElem && videoBtn) {
    videoBtn.addEventListener("click", () => {
        if (videoElem.paused) {
            // Play 누를 때: 시간을 0초(처음)로 되돌리고, 재생하고, 까만 화면 해제
            videoElem.currentTime = 0;
            videoElem.play();
            videoElem.classList.remove("is-blacked-out");
            videoBtn.textContent = "Pause";
        } else {
            // Pause 누를 때: 영상을 정지하고, 까만 화면 적용
            videoElem.pause();
            videoElem.classList.add("is-blacked-out");
            videoBtn.textContent = "Play";
        }
    });
}
