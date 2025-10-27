// Firebase Config & Init
// ഫയർബേസ് കോൺഫിഗറേഷൻ (വേർഷൻ 12.4.0)
const firebaseConfig = { apiKey: "AIzaSyDBfnce5gtJhW9u1xwU2FVPQGx2KvG1vw8", authDomain: "result25.firebaseapp.com", projectId: "result25", storageBucket: "result25.firebasestorage.app", messagingSenderId: "1099340945335", appId: "1:1099340945335:web:4fdc63db6bf6b40a30ba32", measurementId: "G-S4BJW3N642" };
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
const finalFirebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
finalFirebaseConfig.projectId = appId;

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

try { await signInAnonymously(auth); } catch(error) { console.error("Anonymous sign-in failed: ", error); }

// ===================================
// ഡാറ്റാ കോൺഫിഗറേഷൻ
// ===================================
let TEAM_NAMES = [];
let processedTeamData = {}, processedProgramData = [], processedTalentData = {}, processedScoreboardData = {};
let publishedResultsCount = 0;
let dbPrograms = null, dbTeams = null, dbCategories = null, dbHomepage = null;
let dbResults = null;
const d = document;
let dbParticipants = null; // പഴയ റിസൾട്ടുകൾക്ക് വേണ്ടി

// ===================================
// ഡാറ്റാ പ്രോസസ്സിംഗ്
// ===================================
function getTeamFromChest(chestNo) {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു - പഴയ റിസൾട്ടുകൾക്ക് ഇത് ആവശ്യമാണ്)
    if (!chestNo || typeof chestNo !== 'string') return null;
    if (dbTeams == null || dbParticipants == null) return null;
    for (const teamName of TEAM_NAMES) { if (chestNo.toUpperCase() === teamName) return teamName; }
    if (dbParticipants[chestNo] && dbParticipants[chestNo].team) { return dbParticipants[chestNo].team; }
    const chestNumberMatch = chestNo.match(/^\d+/);
    if (chestNumberMatch) {
        const chestNumber = parseInt(chestNumberMatch[0], 10);
        for (const team of Object.values(dbTeams)) {
            const idFrom = parseInt(team.id_from, 10);
            const idTo = parseInt(team.id_to, 10);
            if (!isNaN(idFrom) && !isNaN(idTo) && chestNumber >= idFrom && chestNumber <= idTo) {
                return team.name;
            }
        }
    }
    return null;
}

function initializeTeamData() {
    const data = {};
    if (dbTeams == null || dbCategories == null) return data;
    TEAM_NAMES = Object.keys(dbTeams);
    TEAM_NAMES.forEach(team => {
        data[team] = { name: team, total: 0 };
        dbCategories.forEach(cat => { data[team][cat.name] = 0; });
        data[team]['group'] = 0; // Group points
    });
    return data;
}

function processAllData() {
    if (dbCategories == null || dbTeams == null || dbHomepage == null || dbPrograms == null || dbResults == null || dbParticipants == null) {
        console.warn("processAllData called, but essential data is null. Waiting...");
        return;
    }

    const currentResults = dbResults;
    processedTeamData = initializeTeamData();
    processedProgramData = [];
    const talentPoints = {};
    processedScoreboardData = { eventPoints: {}, categoryTotals: {}, categoryCounts: {} };
    let resultsCount = 0;
    const categoryNames = dbCategories.map(cat => cat.name);
    categoryNames.push('group'); // Add 'group' for internal processing
    categoryNames.forEach(catName => {
        processedScoreboardData.categoryTotals[catName] = {};
        TEAM_NAMES.forEach(team => { processedScoreboardData.categoryTotals[catName][team] = 0; });
        processedScoreboardData.categoryCounts[catName] = 0;
    });

    for (const programId in currentResults) {
        const program = dbPrograms[programId];
        if (!program) continue;

        const eventName = program.name, categoryName = program.category, winners = currentResults[programId];
        if (!((winners.first && winners.first.length > 0) || (winners.second && winners.second.length > 0) || (winners.third && winners.third.length > 0))) continue;
        resultsCount++;

        const currentPoints = {
            first: parseInt(program.points_first || 5, 10),
            second: parseInt(program.points_second || 3, 10),
            third: parseInt(program.points_third || 1, 10)
        };

        const isGroupEvent = program.isGroupEvent || false;

        if (isGroupEvent && program.points_first === 5 && program.points_second === 3) {
            currentPoints.first = 10;
            currentPoints.second = 8;
            currentPoints.third = 5;
        }

        const filterCategory = isGroupEvent ? 'group' : categoryName;
        // isGroup ഫ്ലാഗ് eventScore-ൽ ചേർക്കുന്നു
        const eventScore = { category: categoryName, isGroup: isGroupEvent };
        TEAM_NAMES.forEach(team => { eventScore[team] = { points: 0, positions: [] }; });

        for (const position of ['first', 'second', 'third']) {
            if (winners[position] && winners[position].length > 0) {
                winners[position].forEach(winner => {
                    const team = winner.team || getTeamFromChest(winner.chest);
                    if (team && processedTeamData[team]) {
                        const pointValue = currentPoints[position];
                        processedTeamData[team].total += pointValue;
                        const pointCategoryKey = isGroupEvent ? 'group' : categoryName;
                        if (processedTeamData[team][pointCategoryKey] !== undefined) {
                           processedTeamData[team][pointCategoryKey] += pointValue;
                        }
                        if (!isGroupEvent) {
                            const winnerName = winner.name || (dbParticipants[winner.chest] ? dbParticipants[winner.chest].name : 'Unknown');
                            const winnerIdentifier = `${winner.chest} ${winnerName}`;
                            if (!talentPoints[winnerIdentifier]) {
                                talentPoints[winnerIdentifier] = { points: 0, category: categoryName, team: team };
                            }
                            talentPoints[winnerIdentifier].points += pointValue;
                        }
                        eventScore[team].points += pointValue;
                        eventScore[team].positions.push(position === 'first' ? 1 : (position === 'second' ? 2 : 3));
                    }
                });
            }
        }
        processedScoreboardData.eventPoints[eventName] = eventScore;
        const scoreboardCat = isGroupEvent ? 'group' : categoryName;
        // scoreboardCat ഡാറ്റയിൽ ഉണ്ടോ എന്ന് ഉറപ്പുവരുത്തുന്നു
        if (processedScoreboardData.categoryTotals[scoreboardCat]) {
            TEAM_NAMES.forEach(team => { processedScoreboardData.categoryTotals[scoreboardCat][team] += eventScore[team].points; });
            processedScoreboardData.categoryCounts[scoreboardCat]++;
        } else {
             console.warn(`Scoreboard category '${scoreboardCat}' not initialized. Skipping totals update for event '${eventName}'.`);
        }

        const populatedWinners = {};
        for (const pos of ['first', 'second', 'third']) {
            if (winners[pos]) {
                populatedWinners[pos] = winners[pos].map(w => ({
                    ...w,
                    name: w.name || (dbParticipants[w.chest] ? dbParticipants[w.chest].name : (TEAM_NAMES.includes(w.chest.toUpperCase()) ? w.chest.toUpperCase() : 'Unknown')),
                    team: w.team || getTeamFromChest(w.chest) || 'N/A'
                }));
            }
        }

        processedProgramData.push({ eventName, categoryName, filterCategory, winners: populatedWinners, currentPoints });
    }

    processedTalentData = {};
    for (const studentKey in talentPoints) {
        const { points, category, team } = talentPoints[studentKey];
        if (!processedTalentData[category]) processedTalentData[category] = [];
        processedTalentData[category].push({ name: studentKey, points, team: team });
    }
    for (const category in processedTalentData) { processedTalentData[category].sort((a, b) => b.points - a.points); }

    publishedResultsCount = resultsCount;
    renderAllComponents();
}

// ===================================
// റെൻഡറിംഗ് ഫംഗ്ഷനുകൾ
// ===================================

function renderAllComponents() {
    if (dbCategories == null) {
        console.log("Render skipped: Categories not loaded.");
        return;
    }
    generateFilterButtons();
    generateTeamCards();
    generateDetailedRankings();
    renderProgramResults();
    generateTalentList();
    generateScoreboard();
    generateStaticContent();
    updateResultCounts();

    const defaultScoreboardFilter = (dbCategories && dbCategories.length > 0) ? dbCategories[0].name : 'group'; // ഗ്രൂപ്പ് ഇല്ലെങ്കിൽ ഡിഫോൾട്ടായി 'group' കാണിക്കാം
    filterScoreboard(defaultScoreboardFilter); // ഡിഫോൾട്ട് ഫിൽട്ടർ പ്രയോഗിക്കുന്നു

    d.getElementById('loading-overlay').style.opacity = '0';
    setTimeout(() => {
        d.getElementById('loading-overlay').style.display = 'none';
        d.getElementById('main-content').style.visibility = 'visible';
    }, 500);
}

function generateFilterButtons() {
    const programFiltersEl = d.getElementById('program-filter-buttons');
    const scoreboardFiltersEl = d.getElementById('scoreboard-filter-buttons');
    let buttonsHtml = `<button class="filter-btn active" data-filter="all" onclick="filterResults('all')">All</button>`;
    (dbCategories || []).forEach(cat => {
        buttonsHtml += `<button class="filter-btn" data-filter="${cat.name}" onclick="filterResults('${cat.name}')">${cat.name}</button>`;
    });
    buttonsHtml += `<button class="filter-btn" data-filter="group" onclick="filterResults('group')">Group Events</button>`;
    if (programFiltersEl) programFiltersEl.innerHTML = buttonsHtml;

    let scoreboardButtonsHtml = '';
    (dbCategories || []).forEach((cat, index) => {
        // ആദ്യത്തെ കാറ്റഗറി ഡിഫോൾട്ടായി ആക്റ്റീവ് ആക്കുന്നു
        scoreboardButtonsHtml += `<button class="filter-btn ${index === 0 ? 'active' : ''}" data-filter="${cat.name}" onclick="filterScoreboard('${cat.name}')">${cat.name}</button>`;
    });
    // കാറ്റഗറികൾ ഇല്ലെങ്കിൽ 'group' ഡിഫോൾട്ടായി ആക്റ്റീവ് ആക്കുന്നു
    scoreboardButtonsHtml += `<button class="filter-btn ${(dbCategories || []).length === 0 ? 'active' : ''}" data-filter="group" onclick="filterScoreboard('group')">Group Events</button>`;
    if (scoreboardFiltersEl) {
        if((dbCategories || []).length === 0) {
             scoreboardButtonsHtml = "<p class='text-gray-500 mr-4'>No categories added yet.</p>" + scoreboardButtonsHtml; // കാറ്റഗറി ഇല്ലെങ്കിൽ ഒരു മെസ്സേജ് കാണിക്കുന്നു
        }
        scoreboardFiltersEl.innerHTML = scoreboardButtonsHtml;
    }
}


function generateTeamCards() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
    const dataToRank = processedTeamData || {};
    const rankedTeams = Object.values(dataToRank).sort((a, b) => b.total - a.total);
    const container = d.getElementById('team-cards-container');
    if (!container) { console.error("Team card container not found"); return; }
    container.innerHTML = '';
    const cardClasses = ['champion', 'first-runner-up', 'second-runner-up'];
    const positionTexts = ['Champions', 'First Runners-up', 'Second Runners-up'];
    const iconClasses = ['fas fa-crown', 'fas fa-medal', 'fas fa-medal'];
    rankedTeams.slice(0, 3).forEach((team, i) => { container.innerHTML += `<div class="team-card ${cardClasses[i] || ''}"><div class="icon"><i class="${iconClasses[i] || 'fas fa-award'}"></i></div><div class="team-name">${team.name}</div><p class="points"><b>${team.total}</b></p><p class="position">${positionTexts[i] || `#${i + 1} Position`}</p></div>`; });
    if (rankedTeams.length === 0) { container.innerHTML = '<p class="text-gray-500">No teams have scored yet.</p>'; }
}

function generateDetailedRankings() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
    const container = d.getElementById('detailed-rankings');
    if (!container) return;
    const dataToRank = processedTeamData || {};
    const rankedTeams = Object.values(dataToRank).sort((a, b) => b.total - a.total);
    const maxScore = rankedTeams.length > 0 ? rankedTeams[0].total : 0;
    let headerCols = '', gridTemplateCols = '40px 1.5fr';
    (dbCategories || []).forEach(cat => { headerCols += `<div>${cat.name}</div>`; gridTemplateCols += ' 0.8fr'; });
    gridTemplateCols += ' 0.8fr 1fr 1fr'; // 'group' column added
    let tableHtml = `<div class="rankings-table-content" style="min-width: ${700 + (dbCategories || []).length * 80}px;"><div class="ranking-header" style="grid-template-columns: ${gridTemplateCols};"><div>Rank</div><div>Team</div>${headerCols}<div>Group</div><div>Total</div><div>Progress</div></div>`;
    rankedTeams.forEach((team, index) => {
        const rank = index + 1;
        const progress = maxScore > 0 ? (team.total / maxScore) * 100 : 0;
        let pointsCols = '';
        (dbCategories || []).forEach((cat, i) => { pointsCols += `<div><span class="points-pill default-pill-${(i % 6) + 1}">${team[cat.name] || 0}</span></div>`; });
        pointsCols += `<div><span class="points-pill group">${team['group'] || 0}</span></div>`; // Group points
        tableHtml += `<div class="ranking-row" style="grid-template-columns: ${gridTemplateCols};"><div><span class="rank-cell ${rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''))}">${rank}</span></div><div class="team-name-cell">${team.name}</div>${pointsCols}<div class="total-points-cell">${team.total}</div><td><div class="progress-circle-container"><div class="progress-circle" style="--p:${progress};"><span class="progress-circle-text">${Math.round(progress)}%</span></div></div></td></div>`;
    });
    tableHtml += '</div>';
    container.innerHTML = `<h2>Detailed Rankings</h2><p>Complete scoreboard with detailed breakdown by category</p>${tableHtml}`;
}

function renderProgramResults() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
     const grid = d.getElementById('program-results-grid');
    if (!grid) return;
    if (!processedProgramData || processedProgramData.length === 0) { grid.innerHTML = '<p class="text-gray-500 p-4 text-center">No results have been published yet.</p>'; return; }
    grid.innerHTML = '';
    const sortedPrograms = processedProgramData.sort((a, b) => a.eventName.localeCompare(b.eventName));
    sortedPrograms.forEach(program => {
        let winnersHtml = '';
        let searchText = `${program.eventName} ${program.categoryName} `.toLowerCase();
        const positions = ['first', 'second', 'third'];
        const positionClasses = { 'first': 'first-place', 'second': 'second-place', 'third': 'third-place' };
        const positionIcons = { 'first': '<i class="medal-icon fas fa-trophy"></i>', 'second': '<i class="medal-icon fas fa-medal silver"></i>', 'third': '<i class="medal-icon fas fa-medal bronze"></i>' };
        positions.forEach(position => { if (program.winners[position] && program.winners[position].length > 0) { program.winners[position].forEach(winner => { const teamName = winner.team || 'N/A'; const winnerName = winner.name || 'N/A'; searchText += `${winnerName} ${winner.chest} ${teamName} `.toLowerCase(); winnersHtml += `<div class="winner-entry ${positionClasses[position]}">${positionIcons[position]}<div class="winner-details"><div class="name">${winnerName}</div><div class="id-team"><span>${winner.chest}</span>${teamName}</div></div><div class="winner-points"><div class="points-value">${program.currentPoints[position]}</div><div class="points-label">Points</div></div></div>`; }); } });
        grid.innerHTML += `<div class="event-result-card" data-category="${program.filterCategory}" data-search-text="${searchText}"><div class="event-card-header"><h3>${program.eventName}</h3><span class="event-category-tag">${program.categoryName}</span></div><div class="winners-container">${winnersHtml || '<p style="color: var(--subtle-text); text-align: center;">Result details not available.</p>'}</div></div>`;
    });
    const activeFilterButton = d.querySelector('#program-tab .filter-btn.active');
    filterResults(activeFilterButton ? activeFilterButton.dataset.filter : 'all');
 }

function generateTalentList() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
    const container = d.getElementById('talent-list-container');
    if (!container) return;
    const categories = Object.keys(processedTalentData || {}).sort();
    if (!processedTalentData || categories.length === 0) { container.innerHTML = '<p class="text-gray-500 p-4 text-center">Individual talent points will appear here once results are published.</p>'; return; }
    container.innerHTML = '';
    categories.forEach(category => {
        const students = processedTalentData[category];
        const listId = `talent-list-${category.replace(/\s+/g, '-').toLowerCase()}`;
        let listHtml = '<div class="talent-list">'; let dropdownHtml = '';
        const positionIcons = { 0: '<i class="medal-icon fas fa-trophy"></i>', 1: '<i class="medal-icon fas fa-medal silver"></i>', 2: '<i class="medal-icon fas fa-medal bronze"></i>' }; const positionClasses = { 0: 'first-place', 1: 'second-place', 2: 'third-place' };
        students.forEach((student, index) => { const nameParts = student.name.split(' '); const chest = nameParts.length > 1 ? nameParts[0] : student.name; const name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown Name'; const teamName = student.team || 'N/A'; const entryHtml = `<div class="winner-entry ${positionClasses[index] || ''}">${positionIcons[index] || `<span class="medal-icon">${index + 1}</span>`}<div class="winner-details"><div class="name">${name}</div><div class="id-team"><span>${chest}</span>${teamName}</div></div><div class="winner-points"><div class="points-value">${student.points}</div><div class="points-label">Points</div></div></div>`; if (index < 5 || students.length <= 8) { listHtml += entryHtml; } else { dropdownHtml += entryHtml; } }); listHtml += '</div>'; if (dropdownHtml) { listHtml += `<div id="${listId}" class="talent-dropdown-list">${dropdownHtml}</div><button class="show-more-btn" onclick="toggleTalentDropdown('${listId}', this)">Show More</button>`; }
        container.innerHTML += `<div class="talent-category-card"><h3>${category}</h3>${listHtml}</div>`;
    });
}

function generateScoreboard() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
    const container = d.getElementById('scoreboard-container');
    const placeholder = d.getElementById('scoreboard-placeholder');
    const tableContent = d.getElementById('scoreboard-table-content');
    if (!container || !placeholder || !tableContent) { console.error("Scoreboard elements not found"); return; }
    tableContent.innerHTML = '';
    placeholder.style.display = 'block'; placeholder.textContent = 'Loading scoreboard...';
    if (!processedScoreboardData || !processedScoreboardData.eventPoints || Object.keys(processedScoreboardData.eventPoints).length === 0) { placeholder.textContent = 'No scoreboard data available yet.'; return; }
    placeholder.style.display = 'none';
    const sortedTeams = TEAM_NAMES.sort();
    let totalRows = ''; sortedTeams.forEach(team => { totalRows += `<div class="scoreboard-team-row"><span>${team}</span><span data-team="${team}">0</span></div>`; });
    const totalCardHTML = `<div class="scoreboard-card total-card" id="scoreboard-total-card"><h3>TOTALS</h3><p id="scoreboard-category-count" class="category-count-text">Results: 0</p>${totalRows}</div>`; tableContent.insertAdjacentHTML('beforeend', totalCardHTML);
    const sortedEvents = Object.keys(processedScoreboardData.eventPoints).sort(); let eventCardsHTML = '';
    sortedEvents.forEach(eventName => { const eventData = processedScoreboardData.eventPoints[eventName]; let eventRows = ''; sortedTeams.forEach(team => { const teamData = eventData[team]; if (teamData && teamData.points > 0) { eventRows += `<div class="scoreboard-team-row"><span>${team}</span><span>${getTrophyIconsHTML(teamData.positions)}${teamData.points}</span></div>`; } }); if (eventRows) { const isGroup = eventData.isGroup || false; const cardCategory = isGroup ? 'group' : eventData.category; eventCardsHTML += `<div class="scoreboard-card" data-event-name="${eventName}" data-category="${cardCategory}" style="display: none;"><div class="scoreboard-event-header"><span>${eventName}</span></div>${eventRows}</div>`; } }); tableContent.insertAdjacentHTML('beforeend', eventCardsHTML);
    container.innerHTML = tableContent.innerHTML + `<div class="scoreboard-legend"><span><i class="fas fa-trophy trophy-icon gold"></i> Gold</span><span><i class="fas fa-trophy trophy-icon silver"></i> Silver</span><span><i class="fas fa-trophy trophy-icon bronze"></i> Bronze</span></div>`;
}

function generateStaticContent() {
    // (ഈ ഫംഗ്ഷൻ മാറ്റമില്ലാതെ തുടരുന്നു)
     const setText = (id, value, fallback = '') => { const el = d.getElementById(id); if (el) el.textContent = value || fallback; };
    const setSrc = (id, value, fallback) => { const el = d.getElementById(id); if (el) el.src = value || fallback; };
    const leadersSection = d.getElementById('leaders'); const gallerySection = d.getElementById('gallery');
    if (!dbHomepage) { console.log("Static content render skipped: dbHomepage is null."); setText('dynamic-header-title', 'Results 2025'); setText('hero-main-title', 'Results'); setText('hero-subtitle', 'Live Updates'); setText('about-text', 'Loading content...'); if(leadersSection) leadersSection.style.display = 'none'; if(gallerySection) gallerySection.style.display = 'none'; return; }
    if(leadersSection) leadersSection.style.display = 'block'; if(gallerySection) gallerySection.style.display = 'block'; const data = dbHomepage;
    setText('dynamic-header-title', data.header_title, 'Sadaye Madeena 2k25'); setSrc('hero-logo', data.logo_url, 'https://placehold.co/150x150/FFFFFF/EFEFEF?text=Logo'); setText('hero-main-title', data.main_title, 'Sadaye Madeena 2k25'); setText('hero-subtitle', data.subtitle, 'Inter-Madrasa Art Fest'); setText('about-section-title', data.about_title, 'About The Fest'); setText('about-section-subtitle', data.about_subtitle, 'Thirunoor\'25'); setText('about-text', data.about, 'Welcome...'); setSrc('about-image', data.about_image_url, 'https://placehold.co/800x400/EFEFEF/CCCCCC?text=Event+Image'); setText('stats-programs-public', data.total_programs, '-'); setText('stats-participants-public', data.total_participants, '-'); setText('stats-categories-public', data.total_categories, '-'); setText('stats-teams-public', data.total_teams, '-');
   const leaderContainer = d.getElementById('leader-cards-container'); const leaderPlaceholder = d.getElementById('leader-placeholder');
   if (leaderContainer) { leaderContainer.innerHTML = ''; if (dbTeams && Object.keys(dbTeams).length > 0) { if(leaderPlaceholder) leaderPlaceholder.style.display = 'none'; const sortedTeams = Object.values(dbTeams).sort((a,b) => (a.name || '').localeCompare(b.name || '')); sortedTeams.forEach(team => { leaderContainer.innerHTML += `<div class="leader-card"><h3>${team.name || 'N/A'}</h3><div class="score">Chest No: ${team.id_from || '?'} - ${team.id_to || '?'}</div><div class="leader-info"><div><span>Leader</span> <span>${team.leader || 'N/A'}</span></div><div><span>Asst. Leader</span> <span>${team.asst || 'N/A'}</span></div></div></div>`; }); } else if (leaderPlaceholder) { leaderPlaceholder.textContent = dbTeams === null ? 'Loading leaders...' : 'No teams found.'; leaderPlaceholder.style.display = 'block'; } }
    const galleryContainer = d.getElementById('gallery-rows-container'); const galleryPlaceholder = d.getElementById('gallery-placeholder'); const galleryUrls = data.gallery || []; const rowElements = [d.getElementById('gallery-row-0'), d.getElementById('gallery-row-1'), d.getElementById('gallery-row-2')];
    rowElements.forEach(row => { if(row) row.innerHTML = ''; }); if (galleryUrls.length > 0) { if(galleryPlaceholder) galleryPlaceholder.style.display = 'none'; galleryUrls.forEach((url, index) => { const rowIndex = index % 3; if(rowElements[rowIndex]){ rowElements[rowIndex].innerHTML += `<div class="gallery-item-wrapper"><img src="${url}" alt="Gallery ${index + 1}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/200x280/EFEFEF/CCC?text=Error';"><button class="share-btn" data-url="${url}"><i class="fas fa-share-alt"></i></button></div>`; } }); } else if (galleryPlaceholder) { galleryPlaceholder.textContent = 'No gallery images added yet.'; galleryPlaceholder.style.display = 'block'; }
    setText('footer-institution-name', data.institution_name, 'Institution'); setText('footer-copyright', data.copyright_text, `© ${new Date().getFullYear()}`); const socialIconsContainer = d.getElementById('footer-social-icons'); if(socialIconsContainer){ socialIconsContainer.innerHTML = ''; let hasSocials = false; if (data.social_instagram) { socialIconsContainer.innerHTML += `<a href="${data.social_instagram}" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>`; hasSocials = true; } if (data.social_youtube) { socialIconsContainer.innerHTML += `<a href="${data.social_youtube}" target="_blank" aria-label="YouTube"><i class="fab fa-youtube"></i></a>`; hasSocials = true; } if (data.social_facebook) { socialIconsContainer.innerHTML += `<a href="${data.social_facebook}" target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>`; hasSocials = true; } socialIconsContainer.style.display = hasSocials ? 'block' : 'none'; }
 }

// ===================================
// UI പ്രവർത്തനങ്ങൾ (ബട്ടൺ ക്ലിക്കുകൾ)
// ===================================
window.openNav = function() { d.getElementById("menu-overlay").style.display = "flex"; d.getElementById("main-content").style.filter = 'blur(4px)'; setTimeout(() => d.getElementById("menu-overlay").style.opacity = '1', 10); }
window.closeNav = function() { d.getElementById("menu-overlay").style.opacity = '0'; setTimeout(() => d.getElementById("menu-overlay").style.display = "none", 300); d.getElementById("main-content").style.filter = 'none'; }
window.showPage = function(pageId) { d.getElementById('home-page').style.display = pageId === 'home-page' ? 'block' : 'none'; d.getElementById('scoreboard-page').style.display = pageId === 'scoreboard-page' ? 'block' : 'none'; const scrollTopBtn = d.getElementById('scrollTopBtn'); if (scrollTopBtn) { if (pageId === 'home-page') { handleScroll(); } else { scrollTopBtn.classList.remove('show'); } } updateMenuActiveState(); }
window.showMainTab = function(tabId) { const currentActiveButton = d.querySelector('#scoreboard-page .main-tab-button.active'); const clickedButton = d.querySelector(`.main-tab-button[onclick*="'${tabId}'"]`); if (clickedButton && clickedButton.isSameNode(currentActiveButton)) return; if (currentActiveButton) currentActiveButton.classList.remove('active'); d.querySelectorAll('.main-tab-content').forEach(tab => tab.classList.remove('active')); d.getElementById(tabId).classList.add('active'); if (clickedButton) clickedButton.classList.add('active'); updateMenuActiveState(); }
window.filterResults = function(category = 'all') { d.querySelectorAll('#program-tab .filter-btn').forEach(btn => btn.classList.remove('active')); d.querySelector(`#program-tab .filter-btn[data-filter="${category}"]`).classList.add('active'); const searchTerm = d.getElementById('search-input').value.toLowerCase(); d.querySelectorAll('.event-result-card').forEach(card => { const categoryMatch = (category === 'all' || card.dataset.category === category); const searchMatch = (card.dataset.searchText.includes(searchTerm)); card.style.display = (categoryMatch && searchMatch) ? 'block' : 'none'; }); }

// *** മാറ്റം വരുത്തി: സ്കോർബോർഡ് ഫിൽട്ടർ ലോജിക് ശരിയാക്കി ***
window.filterScoreboard = function(category) {
    if (!processedScoreboardData) return; // ഡാറ്റ ലോഡ് ആയിട്ടില്ലെങ്കിൽ ഒന്നും ചെയ്യരുത്
    d.querySelectorAll('#scoreboard-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeButton = d.querySelector(`#scoreboard-filter-buttons .filter-btn[data-filter="${category}"]`);
    if (activeButton) activeButton.classList.add('active');

    const totalsToShow = processedScoreboardData.categoryTotals[category];
    const totalCard = d.getElementById('scoreboard-total-card');
    const countElement = d.getElementById('scoreboard-category-count');

    if (totalCard && totalsToShow) {
        TEAM_NAMES.forEach(team => {
            const teamSpan = totalCard.querySelector(`span[data-team="${team}"]`);
            if (teamSpan) teamSpan.textContent = totalsToShow[team] || 0;
        });
    }
    if (countElement) {
        const count = processedScoreboardData.categoryCounts[category] || 0;
        countElement.textContent = `Published Results: ${count}`;
    }

    // എല്ലാ ഇവന്റ് കാർഡുകളും എടുക്കുന്നു (ടോട്ടൽ കാർഡ് ഒഴികെ)
    d.querySelectorAll('#scoreboard-container .scoreboard-card:not(.total-card)').forEach(card => {
        // കാർഡിന്റെ ഡാറ്റാ ആട്രിബ്യൂട്ടിൽ നിന്നും കാറ്റഗറി എടുക്കുന്നു
        const cardCategory = card.dataset.category;
        // ഇപ്പോൾ തിരഞ്ഞെടുത്ത കാറ്റഗറിയുമായി ഒത്തുനോക്കുന്നു
        if (cardCategory === category) {
            card.style.display = 'block'; // ശരിയാണെങ്കിൽ കാണിക്കുന്നു
        } else {
            card.style.display = 'none'; // അല്ലെങ്കിൽ മറയ്ക്കുന്നു
        }
    });
}


window.updateResultCounts = function() { const el = d.getElementById('team-results-count'); if (el) el.innerText = `Team point status after ${publishedResultsCount} results`; }
window.getTrophyIconsHTML = function(positions) { if (!positions || positions.length === 0) return ''; return positions.map(pos => { if (pos === 1) return '<i class="fas fa-trophy trophy-icon gold"></i>'; if (pos === 2) return '<i class="fas fa-trophy trophy-icon silver"></i>'; if (pos === 3) return '<i class="fas fa-trophy trophy-icon bronze"></i>'; return ''; }).join(''); }
window.toggleTalentDropdown = function(listId, button) { const list = d.getElementById(listId); list.classList.toggle('open'); button.textContent = list.classList.contains('open') ? 'Show Less' : 'Show More'; }
window.updateMenuActiveState = function() { const homePageVisible = d.getElementById('home-page').style.display !== 'none'; d.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active')); if (homePageVisible) { const homeLink = d.querySelector('.menu-link[data-target="home-page"]'); if (homeLink) homeLink.classList.add('active'); } else { const activeTabButton = d.querySelector('#scoreboard-page .main-tab-button.active'); if (activeTabButton) { const tabId = activeTabButton.getAttribute('onclick').match(/'([^']+)'/)[1]; const activeMenuLink = d.querySelector(`.menu-link[data-target="${tabId}"]`); if (activeMenuLink) activeMenuLink.classList.add('active'); } else { const programLink = d.querySelector('.menu-link[data-target="program-tab"]'); if (programLink) programLink.classList.add('active'); } } }
async function shareImage(imageUrl) { if (navigator.share) { try { await navigator.share({ title: 'Sadaye Madeena 2k25 Gallery Image', text: 'Check out this image from the fest!', url: imageUrl }); console.log('Image shared successfully'); } catch (err) { console.error('Error sharing image:', err); alert('Sharing failed.'); } } else { try { const textArea = d.createElement("textarea"); textArea.value = imageUrl; textArea.style.position = "fixed"; d.body.appendChild(textArea); textArea.focus(); textArea.select(); d.execCommand('copy'); d.body.removeChild(textArea); alert('Sharing not supported, but image link copied to clipboard!'); } catch (err) { alert('Sharing is not supported on this browser. Please copy the link manually.'); console.error('Fallback copy failed:', err); } } }
d.addEventListener('click', function(event) { const shareButton = event.target.closest('.share-btn'); if (shareButton) { const imageUrl = shareButton.dataset.url; if (imageUrl) { event.stopPropagation(); shareImage(imageUrl); } } });
const scrollTopBtn = d.getElementById('scrollTopBtn');
function handleScroll() { const homePageVisible = d.getElementById('home-page').style.display !== 'none'; if (homePageVisible && window.scrollY > 300) { if(scrollTopBtn) scrollTopBtn.classList.add('show'); } else { if(scrollTopBtn) scrollTopBtn.classList.remove('show'); } }
window.scrollToTop = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
window.addEventListener('scroll', handleScroll);

// ===================================
// ആപ്ലിക്കേഷൻ ആരംഭിക്കുമ്പോൾ
// ===================================
let allDataLoaded = false;
let loadStatus = { results: false, programs: false, teams: false, homepage: false, categories: false, participants: false };

function checkAllDataLoaded() {
    if (allDataLoaded) {
        processAllData();
        return;
    }
    if (loadStatus.results && loadStatus.programs && loadStatus.teams && loadStatus.homepage && loadStatus.categories && loadStatus.participants) {
        allDataLoaded = true;
        console.log("All data loaded. Processing...");
        processAllData();
    }
}
// Firebase Listeners
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/results`)), (snapshot) => { dbResults = {}; snapshot.docs.forEach(doc => { dbResults[doc.id] = doc.data(); }); loadStatus.results = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading results: ", e); dbResults = {}; loadStatus.results = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/programs`)), (snapshot) => { dbPrograms = {}; snapshot.docs.forEach(doc => { dbPrograms[doc.id] = doc.data(); }); loadStatus.programs = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading programs: ", e); dbPrograms = {}; loadStatus.programs = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/teams`)), (snapshot) => { dbTeams = {}; snapshot.docs.forEach(doc => { dbTeams[doc.id] = doc.data(); }); loadStatus.teams = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading teams: ", e); dbTeams = {}; loadStatus.teams = true; checkAllDataLoaded(); });
onSnapshot(doc(db, `artifacts/${appId}/public/data/config`, 'homepage'), (docSnap) => { dbHomepage = docSnap.exists() ? docSnap.data() : {}; loadStatus.homepage = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading homepage: ", e); dbHomepage = {}; loadStatus.homepage = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/categories`)), (snapshot) => { dbCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.name.localeCompare(b.name)); loadStatus.categories = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading categories: ", e); dbCategories = []; loadStatus.categories = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/participants`)), (snapshot) => { dbParticipants = {}; snapshot.docs.forEach(doc => { dbParticipants[doc.id] = doc.data(); }); loadStatus.participants = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading participants: ", e); dbParticipants = {}; loadStatus.participants = true; checkAllDataLoaded(); });


window.onload = function() {
    showPage('home-page');
    updateMenuActiveState();
    showMainTab('team-tab');
};

