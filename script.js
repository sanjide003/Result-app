// Firebase Config & Init
// ഫയർബേസ് കോൺഫിഗറേഷൻ (ഇത് നിങ്ങളുടെ പഴയ കോഡിൽ നിന്നും എടുത്തതാണ്)
const firebaseConfig = { apiKey: "AIzaSyDBfnce5gtJhW9u1xwU2FVPQGx2KvG1vw8", authDomain: "result25.firebaseapp.com", projectId: "result25", storageBucket: "result25.firebasestorage.app", messagingSenderId: "1099340945335", appId: "1:1099340945335:web:4fdc63db6bf6b40a30ba32", measurementId: "G-S4BJW3N642" };
const appId = typeof __app_id !== 'undefined' ? __app_id : firebaseConfig.projectId;
const finalFirebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
finalFirebaseConfig.projectId = appId;

// Firebase മൊഡ്യൂളുകൾ ഇമ്പോർട്ട് ചെയ്യുന്നു (വേർഷൻ 12.4.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore, doc, onSnapshot, collection, query } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ആരും ലോഗിൻ ചെയ്തിട്ടില്ലെങ്കിലും ഡാറ്റ കാണാൻ വേണ്ടി അനോണിമസ് ആയി സൈൻ-ഇൻ ചെയ്യുന്നു
try { await signInAnonymously(auth); } catch(error) { console.error("Anonymous sign-in failed: ", error); }

// ===================================
// ഡാറ്റാ കോൺഫിഗറേഷൻ
// ===================================
let TEAM_NAMES = [];
// *** മാറ്റം വരുത്തി: groupEvents എന്ന ഹാർഡ്‌കോഡ് ലിസ്റ്റ് നീക്കം ചെയ്തു ***
// (ഇപ്പോൾ ഇത് പ്രോഗ്രാമിൽ നിന്നാണ് നേരിട്ട് വരുന്നത്)

let processedTeamData = {}, processedProgramData = [], processedTalentData = {}, processedScoreboardData = {};
let publishedResultsCount = 0;
let dbPrograms = null, dbTeams = null, dbCategories = null, dbHomepage = null;
// *** മാറ്റം വരുത്തി: dbParticipants നീക്കം ചെയ്തു (സുരക്ഷയ്ക്കും വേഗതയ്ക്കും വേണ്ടി) ***
let dbResults = null; 
const d = document; // document എന്ന് മുഴുവൻ എഴുതാതിരിക്കാൻ

// ===================================
// ഡാറ്റാ പ്രോസസ്സിംഗ്
// ===================================

// *** മാറ്റം വരുത്തി: getTeamFromChest() എന്ന ഫംഗ്ഷൻ പൂർണ്ണമായും നീക്കം ചെയ്തു ***
// (കാരണം, ടീമിന്റെ പേര് ഇപ്പോൾ റിസൾട്ട് ഡോക്യുമെന്റിൽ നിന്ന് നേരിട്ട് ലഭിക്കും)

function initializeTeamData() { 
    const data = {}; 
    if (dbTeams == null || dbCategories == null) return data; 
    TEAM_NAMES = Object.keys(dbTeams); 
    TEAM_NAMES.forEach(team => { 
        data[team] = { name: team, total: 0 }; 
        dbCategories.forEach(cat => { data[team][cat.name] = 0; }); 
        data[team]['group'] = 0; 
    }); 
    return data; 
}

function processAllData() { 
    // *** മാറ്റം വരുത്തി: dbParticipants എന്ന ഭാഗം നീക്കം ചെയ്തു ***
    if (dbCategories == null || dbTeams == null || dbHomepage == null || dbPrograms == null || dbResults == null) {
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
    categoryNames.push('group'); // 'group' എന്ന പേര് ആന്തരിക പ്രവർത്തനങ്ങൾക്ക് മാത്രം
    categoryNames.forEach(catName => { 
        processedScoreboardData.categoryTotals[catName] = {}; 
        TEAM_NAMES.forEach(team => { processedScoreboardData.categoryTotals[catName][team] = 0; }); 
        processedScoreboardData.categoryCounts[catName] = 0; 
    });
    
    for (const programId in currentResults) {
        const program = dbPrograms[programId];
        if (!program) continue; // പ്രോഗ്രാം ഡാറ്റ കിട്ടിയില്ലെങ്കിൽ ഒഴിവാക്കുക

        const eventName = program.name, categoryName = program.category, winners = currentResults[programId];
        if (!((winners.first && winners.first.length > 0) || (winners.second && winners.second.length > 0) || (winners.third && winners.third.length > 0))) continue;
        resultsCount++;

        // പോയിന്റുകൾ പ്രോഗ്രാം ഡോക്യുമെന്റിൽ നിന്ന് എടുക്കുന്നു
        const currentPoints = {
            first: parseInt(program.points_first || 5, 10), 
            second: parseInt(program.points_second || 3, 10), 
            third: parseInt(program.points_third || 1, 10) 
        };
        
        // *** മാറ്റം വരുത്തി: 'groupEvents' ലിസ്റ്റിന് പകരം പ്രോഗ്രാമിലെ 'isGroupEvent' ഫീൽഡ് ഉപയോഗിക്കുന്നു ***
        const isGroupEvent = program.isGroupEvent || false;
        
        // ഇത് ഗ്രൂപ്പ് ഇവന്റ് ആണെങ്കിൽ, പോയിന്റുകൾ മാറ്റിയെഴുതുന്നു (ഉദാഹരണത്തിന് 10, 8, 5)
        if (isGroupEvent && program.points_first === 5 && program.points_second === 3) {
            currentPoints.first = 10;
            currentPoints.second = 8;
            currentPoints.third = 5;
        }

        const filterCategory = isGroupEvent ? 'group' : categoryName;
        const eventScore = { category: categoryName, isGroup: isGroupEvent }; // isGroup കൂടി ചേർത്തു
        TEAM_NAMES.forEach(team => { eventScore[team] = { points: 0, positions: [] }; });
        
        for (const position of ['first', 'second', 'third']) {
            if (winners[position] && winners[position].length > 0) {
                winners[position].forEach(winner => {
                    // *** മാറ്റം വരുത്തി: 'getTeamFromChest' ന് പകരം 'winner.team' ഉപയോഗിക്കുന്നു ***
                    // ഇത് പ്രവർത്തിക്കാൻ അഡ്മിൻ പാനൽ ശരിയാക്കണം!
                    const team = winner.team; 
                    
                    if (team && processedTeamData[team]) { // ടീം നിലവിലുണ്ടോ എന്ന് പരിശോധിക്കുന്നു
                        const pointValue = currentPoints[position]; 
                        processedTeamData[team].total += pointValue;
                        const pointCategoryKey = isGroupEvent ? 'group' : categoryName;
                        if (processedTeamData[team][pointCategoryKey] !== undefined) {
                           processedTeamData[team][pointCategoryKey] += pointValue;
                        }
                        if (!isGroupEvent) {
                            // *** മാറ്റം വരുത്തി: 'winner.name' ഇപ്പോൾ റിസൾട്ടിൽ നിന്ന് നേരിട്ട് വരണം ***
                            const winnerIdentifier = `${winner.chest} ${winner.name || 'N/A'}`;
                            if (!talentPoints[winnerIdentifier]) {
                                // *** മാറ്റം വരുത്തി: ടാലന്റ് പോയിന്റിൽ ടീമിന്റെ പേര് കൂടി സേവ് ചെയ്യുന്നു ***
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
        if (processedScoreboardData.categoryTotals[scoreboardCat]) {
            TEAM_NAMES.forEach(team => { processedScoreboardData.categoryTotals[scoreboardCat][team] += eventScore[team].points; });
            processedScoreboardData.categoryCounts[scoreboardCat]++;
        }
        // *** മാറ്റം വരുത്തി: 'winner.name', 'winner.team' എന്നിവ ഇപ്പോൾ 'winners' ഒബ്ജക്റ്റിൽ ഉണ്ടാകണം ***
        processedProgramData.push({ eventName, categoryName, filterCategory, winners, currentPoints }); 
    }
    
    processedTalentData = {};
    for (const studentKey in talentPoints) {
        // *** മാറ്റം വരുത്തി: ടീം ഡാറ്റ കൂടി എടുക്കുന്നു ***
        const { points, category, team } = talentPoints[studentKey];
        if (!processedTalentData[category]) processedTalentData[category] = [];
        // *** മാറ്റം വരുത്തി: ടീം ഡാറ്റ കൂടി സേവ് ചെയ്യുന്നു ***
        processedTalentData[category].push({ name: studentKey, points, team: team });
    }
    for (const category in processedTalentData) { processedTalentData[category].sort((a, b) => b.points - a.points); }
    
    publishedResultsCount = resultsCount;
    renderAllComponents(); // എല്ലാ ഡാറ്റയും പ്രോസസ്സ് ചെയ്ത ശേഷം പേജ് റെൻഡർ ചെയ്യുന്നു
}

// ===================================
// റെൻഡറിംഗ് ഫംഗ്ഷനുകൾ (പേജിൽ കാണിക്കുന്നത്)
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
    
    // ഡിഫോൾട്ടായി ഒരു ഫിൽട്ടർ തിരഞ്ഞെടുക്കുന്നു
    const defaultScoreboardFilter = (dbCategories && dbCategories.length > 0) ? dbCategories[0].name : '';
    if (defaultScoreboardFilter) {
        filterScoreboard(defaultScoreboardFilter);
    } else {
        const scoreboardFiltersEl = d.getElementById('scoreboard-filter-buttons');
        if (scoreboardFiltersEl) scoreboardFiltersEl.innerHTML = "<p class='text-gray-500'>Please add categories in the admin panel.</p>";
    }
    
    // ലോഡിംഗ് സ്ക്രീൻ മറയ്ക്കുന്നു
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
    if (programFiltersEl) programFiltersEl.innerHTML = buttonsHtml;
    
    let scoreboardButtonsHtml = ''; 
    (dbCategories || []).forEach((cat, index) => { 
        scoreboardButtonsHtml += `<button class="filter-btn ${index === 0 ? 'active' : ''}" data-filter="${cat.name}" onclick="filterScoreboard('${cat.name}')">${cat.name}</button>`; 
    }); 
    if (scoreboardFiltersEl) {
        if(scoreboardButtonsHtml === '') {
            scoreboardButtonsHtml = "<p class='text-gray-500'>No categories added yet.</p>";
        }
        scoreboardFiltersEl.innerHTML = scoreboardButtonsHtml; 
    }
}

function generateTeamCards() {
    const dataToRank = processedTeamData || {};
    const rankedTeams = Object.values(dataToRank).sort((a, b) => b.total - a.total);
    
    const container = d.getElementById('team-cards-container');
    if (!container) { console.error("Team card container not found"); return; }
    container.innerHTML = ''; 
    
    const cardClasses = ['champion', 'first-runner-up', 'second-runner-up'];
    const positionTexts = ['Champions', 'First Runners-up', 'Second Runners-up'];
    const iconClasses = ['fas fa-crown', 'fas fa-medal', 'fas fa-medal'];
    
    rankedTeams.slice(0, 3).forEach((team, i) => { 
        container.innerHTML += `<div class="team-card ${cardClasses[i] || ''}"><div class="icon"><i class="${iconClasses[i] || 'fas fa-award'}"></i></div><div class="team-name">${team.name}</div><p class="points"><b>${team.total}</b></p><p class="position">${positionTexts[i] || `#${i + 1} Position`}</p></div>`;
    });

    if (rankedTeams.length === 0) {
         container.innerHTML = '<p class="text-gray-500">No teams have scored yet.</p>';
    }
}

function generateDetailedRankings() {
    const container = d.getElementById('detailed-rankings');
    if (!container) return; 
    
    const dataToRank = processedTeamData || {};
    const rankedTeams = Object.values(dataToRank).sort((a, b) => b.total - a.total);
    
    const maxScore = rankedTeams.length > 0 ? rankedTeams[0].total : 0;
    let headerCols = '', gridTemplateCols = '40px 1.5fr';
    
    (dbCategories || []).forEach(cat => { 
        headerCols += `<div>${cat.name}</div>`; 
        gridTemplateCols += ' 0.8fr'; 
    });
    gridTemplateCols += ' 0.8fr 1fr 1fr'; // 'group' കൂടി ചേർത്തു
    
    let tableHtml = `<div class="rankings-table-content" style="min-width: ${700 + (dbCategories || []).length * 80}px;">
                        <div class="ranking-header" style="grid-template-columns: ${gridTemplateCols};">
                            <div>Rank</div><div>Team</div>${headerCols}<div>Group</div><div>Total</div><div>Progress</div>
                        </div>`;
    
    rankedTeams.forEach((team, index) => {
        const rank = index + 1;
        const progress = maxScore > 0 ? (team.total / maxScore) * 100 : 0;
        let pointsCols = '';
        (dbCategories || []).forEach((cat, i) => {
            pointsCols += `<div><span class="points-pill default-pill-${(i % 6) + 1}">${team[cat.name] || 0}</span></div>`;
        });
        // 'group' പോയിന്റുകൾ ചേർക്കുന്നു
        pointsCols += `<div><span class="points-pill group">${team['group'] || 0}</span></div>`;

        tableHtml += `<div class="ranking-row" style="grid-template-columns: ${gridTemplateCols};">
                        <div><span class="rank-cell ${rank === 1 ? 'rank-1' : (rank === 2 ? 'rank-2' : (rank === 3 ? 'rank-3' : ''))}">${rank}</span></div>
                        <div class="team-name-cell">${team.name}</div>
                        ${pointsCols}
                        <div class="total-points-cell">${team.total}</div>
                        <td><div class="progress-circle-container"><div class="progress-circle" style="--p:${progress};"><span class="progress-circle-text">${Math.round(progress)}%</span></div></div></td>
                      </div>`;
    });
    
    tableHtml += '</div>';
    container.innerHTML = `<h2>Detailed Rankings</h2><p>Complete scoreboard with detailed breakdown by category</p>${tableHtml}`;
}

function renderProgramResults() {
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
        
        positions.forEach(position => { 
            if (program.winners[position] && program.winners[position].length > 0) { 
                program.winners[position].forEach(winner => { 
                    // *** മാറ്റം വരുത്തി: 'getTeamFromChest' ന് പകരം 'winner.team' ഉപയോഗിക്കുന്നു ***
                    const teamName = winner.team || 'N/A'; 
                    // *** മാറ്റം വരുത്തി: 'winner.name' ഇപ്പോൾ റിസൾട്ടിൽ നിന്ന് നേരിട്ട് വരണം ***
                    const winnerName = winner.name || 'N/A';
                    searchText += `${winnerName} ${winner.chest} ${teamName} `.toLowerCase(); 
                    winnersHtml += `<div class="winner-entry ${positionClasses[position]}">${positionIcons[position]}<div class="winner-details"><div class="name">${winnerName}</div><div class="id-team"><span>${winner.chest}</span>${teamName}</div></div><div class="winner-points"><div class="points-value">${program.currentPoints[position]}</div><div class="points-label">Points</div></div></div>`; 
                }); 
            } 
        });
        
        grid.innerHTML += `<div class="event-result-card" data-category="${program.filterCategory}" data-search-text="${searchText}"><div class="event-card-header"><h3>${program.eventName}</h3><span class="event-category-tag">${program.categoryName}</span></div><div class="winners-container">${winnersHtml || '<p style="color: var(--subtle-text); text-align: center;">Result details not available.</p>'}</div></div>`;
    });
    const activeFilterButton = d.querySelector('#program-tab .filter-btn.active');
    filterResults(activeFilterButton ? activeFilterButton.dataset.filter : 'all');
 }
 
function generateTalentList() {
    const container = d.getElementById('talent-list-container');
    if (!container) return;
    const categories = Object.keys(processedTalentData || {}).sort();
    if (!processedTalentData || categories.length === 0) { container.innerHTML = '<p class="text-gray-500 p-4 text-center">Individual talent points will appear here once results are published.</p>'; return; }
    container.innerHTML = ''; 
    categories.forEach(category => {
        const students = processedTalentData[category];
        const listId = `talent-list-${category.replace(/\s+/g, '-').toLowerCase()}`;
        let listHtml = '<div class="talent-list">'; 
        let dropdownHtml = '';
        const positionIcons = { 0: '<i class="medal-icon fas fa-trophy"></i>', 1: '<i class="medal-icon fas fa-medal silver"></i>', 2: '<i class="medal-icon fas fa-medal bronze"></i>' }; 
        const positionClasses = { 0: 'first-place', 1: 'second-place', 2: 'third-place' };
        
        students.forEach((student, index) => { 
            const nameParts = student.name.split(' '); 
            const chest = nameParts.length > 1 ? nameParts[0] : student.name; 
            const name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown Name'; 
            
            // *** മാറ്റം വരുത്തി: 'getTeamFromChest' ന് പകരം 'student.team' ഉപയോഗിക്കുന്നു ***
            const teamName = student.team || 'N/A';
            
            const entryHtml = `<div class="winner-entry ${positionClasses[index] || ''}">${positionIcons[index] || `<span class="medal-icon">${index + 1}</span>`}<div class="winner-details"><div class="name">${name}</div><div class="id-team"><span>${chest}</span>${teamName}</div></div><div class="winner-points"><div class="points-value">${student.points}</div><div class="points-label">Points</div></div></div>`; 
            if (index < 5 || students.length <= 8) { 
                listHtml += entryHtml; 
            } else { 
                dropdownHtml += entryHtml; 
            } 
        }); 
        
        listHtml += '</div>'; 
        if (dropdownHtml) { 
            listHtml += `<div id="${listId}" class="talent-dropdown-list">${dropdownHtml}</div><button class="show-more-btn" onclick="toggleTalentDropdown('${listId}', this)">Show More</button>`; 
        }
        container.innerHTML += `<div class="talent-category-card"><h3>${category}</h3>${listHtml}</div>`;
    });
}

function generateScoreboard() {
    const container = d.getElementById('scoreboard-container');
    const placeholder = d.getElementById('scoreboard-placeholder');
    const tableContent = d.getElementById('scoreboard-table-content');
    if (!container || !placeholder || !tableContent) {
        console.error("Scoreboard elements not found");
        return; 
    }
    tableContent.innerHTML = ''; 
    placeholder.style.display = 'block'; 
    placeholder.textContent = 'Loading scoreboard...';
    
    if (!processedScoreboardData || !processedScoreboardData.eventPoints || Object.keys(processedScoreboardData.eventPoints).length === 0) { 
        placeholder.textContent = 'No scoreboard data available yet.'; 
        return; 
    }
    placeholder.style.display = 'none';
    
    const sortedTeams = TEAM_NAMES.sort();
    let totalRows = ''; 
    sortedTeams.forEach(team => { 
        totalRows += `<div class="scoreboard-team-row"><span>${team}</span><span data-team="${team}">0</span></div>`; 
    });
    
    const totalCardHTML = `<div class="scoreboard-card total-card" id="scoreboard-total-card"><h3>TOTALS</h3><p id="scoreboard-category-count" class="category-count-text">Results: 0</p>${totalRows}</div>`; 
    tableContent.insertAdjacentHTML('beforeend', totalCardHTML);
    
    const sortedEvents = Object.keys(processedScoreboardData.eventPoints).sort(); 
    let eventCardsHTML = '';
    sortedEvents.forEach(eventName => {
         const eventData = processedScoreboardData.eventPoints[eventName]; 
         let eventRows = ''; 
         sortedTeams.forEach(team => { 
             const teamData = eventData[team]; 
             if (teamData && teamData.points > 0) { 
                 eventRows += `<div class="scoreboard-team-row"><span>${team}</span><span>${getTrophyIconsHTML(teamData.positions)}${teamData.points}</span></div>`; 
             } 
         }); 
         
         if (eventRows) { 
             const cardCategory = eventData.isGroup ? 'group' : eventData.category; 
             eventCardsHTML += `<div class="scoreboard-card" data-event-name="${eventName}" data-category="${cardCategory}" style="display: none;"><div class="scoreboard-event-header"><span>${eventName}</span></div>${eventRows}</div>`; 
         }
    }); 
    
    tableContent.insertAdjacentHTML('beforeend', eventCardsHTML);
    
    // ലെജൻഡ് ചേർക്കുന്നു
    container.innerHTML = tableContent.innerHTML + `<div class="scoreboard-legend"><span><i class="fas fa-trophy trophy-icon gold"></i> Gold</span><span><i class="fas fa-trophy trophy-icon silver"></i> Silver</span><span><i class="fas fa-trophy trophy-icon bronze"></i> Bronze</span></div>`;
}

function generateStaticContent() {
     const setText = (id, value, fallback = '') => { const el = d.getElementById(id); if (el) el.textContent = value || fallback; };
    const setSrc = (id, value, fallback) => { const el = d.getElementById(id); if (el) el.src = value || fallback; };
    const leadersSection = d.getElementById('leaders'); 
    const gallerySection = d.getElementById('gallery');

    if (!dbHomepage) { 
        console.log("Static content render skipped: dbHomepage is null."); 
        setText('dynamic-header-title', 'Results 2025'); 
        setText('hero-main-title', 'Results'); 
        setText('hero-subtitle', 'Live Updates'); 
        setText('about-text', 'Loading content...'); 
        if(leadersSection) leadersSection.style.display = 'none'; 
        if(gallerySection) gallerySection.style.display = 'none'; 
        return; 
    }
    
    if(leadersSection) leadersSection.style.display = 'block'; 
    if(gallerySection) gallerySection.style.display = 'block';
    const data = dbHomepage;

    setText('dynamic-header-title', data.header_title, 'Sadaye Madeena 2k25'); 
    setSrc('hero-logo', data.logo_url, 'https://placehold.co/150x150/FFFFFF/EFEFEF?text=Logo'); 
    setText('hero-main-title', data.main_title, 'Sadaye Madeena 2k25'); 
    setText('hero-subtitle', data.subtitle, 'Inter-Madrasa Art Fest'); 
    setText('about-section-title', data.about_title, 'About The Fest'); 
    setText('about-section-subtitle', data.about_subtitle, 'Thirunoor\'25'); 
    setText('about-text', data.about, 'Welcome...'); 
    setSrc('about-image', data.about_image_url, 'https://placehold.co/800x400/EFEFEF/CCCCCC?text=Event+Image'); 
    setText('stats-programs-public', data.total_programs, '-'); 
    setText('stats-participants-public', data.total_participants, '-'); 
    setText('stats-categories-public', data.total_categories, '-'); 
    setText('stats-teams-public', data.total_teams, '-');

   const leaderContainer = d.getElementById('leader-cards-container'); 
   const leaderPlaceholder = d.getElementById('leader-placeholder');
   if (leaderContainer) { 
       leaderContainer.innerHTML = ''; 
       if (dbTeams && Object.keys(dbTeams).length > 0) { 
           if(leaderPlaceholder) leaderPlaceholder.style.display = 'none'; 
           const sortedTeams = Object.values(dbTeams).sort((a,b) => (a.name || '').localeCompare(b.name || '')); 
           sortedTeams.forEach(team => { 
               leaderContainer.innerHTML += `<div class="leader-card"><h3>${team.name || 'N/A'}</h3><div class="score">Chest No: ${team.id_from || '?'} - ${team.id_to || '?'}</div><div class="leader-info"><div><span>Leader</span> <span>${team.leader || 'N/A'}</span></div><div><span>Asst. Leader</span> <span>${team.asst || 'N/A'}</span></div></div></div>`; 
           }); 
       } else if (leaderPlaceholder) { 
           leaderPlaceholder.textContent = dbTeams === null ? 'Loading leaders...' : 'No teams found.'; 
           leaderPlaceholder.style.display = 'block'; 
       } 
   }

    const galleryContainer = d.getElementById('gallery-rows-container'); 
    const galleryPlaceholder = d.getElementById('gallery-placeholder'); 
    const galleryUrls = data.gallery || []; 
    const rowElements = [d.getElementById('gallery-row-0'), d.getElementById('gallery-row-1'), d.getElementById('gallery-row-2')];
    
    rowElements.forEach(row => { if(row) row.innerHTML = ''; }); 
    
    if (galleryUrls.length > 0) { 
        if(galleryPlaceholder) galleryPlaceholder.style.display = 'none'; 
        galleryUrls.forEach((url, index) => { 
            const rowIndex = index % 3; 
            if(rowElements[rowIndex]){ 
                rowElements[rowIndex].innerHTML += `<div class="gallery-item-wrapper"><img src="${url}" alt="Gallery ${index + 1}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/200x280/EFEFEF/CCC?text=Error';"><button class="share-btn" data-url="${url}"><i class="fas fa-share-alt"></i></button></div>`; 
            } 
        }); 
    } else if (galleryPlaceholder) { 
        galleryPlaceholder.textContent = 'No gallery images added yet.'; 
        galleryPlaceholder.style.display = 'block'; 
    }

    setText('footer-institution-name', data.institution_name, 'Institution'); 
    setText('footer-copyright', data.copyright_text, `© ${new Date().getFullYear()}`); 
    const socialIconsContainer = d.getElementById('footer-social-icons'); 
    if(socialIconsContainer){ 
        socialIconsContainer.innerHTML = ''; 
        let hasSocials = false; 
        if (data.social_instagram) { 
            socialIconsContainer.innerHTML += `<a href="${data.social_instagram}" target="_blank" aria-label="Instagram"><i class="fab fa-instagram"></i></a>`; 
            hasSocials = true; 
        } 
        if (data.social_youtube) { 
            socialIconsContainer.innerHTML += `<a href="${data.social_youtube}" target="_blank" aria-label="YouTube"><i class="fab fa-youtube"></i></a>`; 
            hasSocials = true; 
        } 
        if (data.social_facebook) { 
            socialIconsContainer.innerHTML += `<a href="${data.social_facebook}" target="_blank" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>`; 
            hasSocials = true; 
        } 
        socialIconsContainer.style.display = hasSocials ? 'block' : 'none'; 
    }
 }

// ===================================
// UI പ്രവർത്തനങ്ങൾ (ബട്ടൺ ക്ലിക്കുകൾ)
// ===================================
window.openNav = function() { d.getElementById("menu-overlay").style.display = "flex"; d.getElementById("main-content").style.filter = 'blur(4px)'; setTimeout(() => d.getElementById("menu-overlay").style.opacity = '1', 10); }
window.closeNav = function() { d.getElementById("menu-overlay").style.opacity = '0'; setTimeout(() => d.getElementById("menu-overlay").style.display = "none", 300); d.getElementById("main-content").style.filter = 'none'; }
window.showPage = function(pageId) { d.getElementById('home-page').style.display = pageId === 'home-page' ? 'block' : 'none'; d.getElementById('scoreboard-page').style.display = pageId === 'scoreboard-page' ? 'block' : 'none'; const scrollTopBtn = d.getElementById('scrollTopBtn'); if (scrollTopBtn) { if (pageId === 'home-page') { handleScroll(); } else { scrollTopBtn.classList.remove('show'); } } updateMenuActiveState(); }
window.showMainTab = function(tabId) { const currentActiveButton = d.querySelector('#scoreboard-page .main-tab-button.active'); const clickedButton = d.querySelector(`.main-tab-button[onclick*="'${tabId}'"]`); if (clickedButton && clickedButton.isSameNode(currentActiveButton)) return; if (currentActiveButton) currentActiveButton.classList.remove('active'); d.querySelectorAll('.main-tab-content').forEach(tab => tab.classList.remove('active')); d.getElementById(tabId).classList.add('active'); if (clickedButton) clickedButton.classList.add('active'); updateMenuActiveState(); }
window.filterResults = function(category = 'all') { d.querySelectorAll('#program-tab .filter-btn').forEach(btn => btn.classList.remove('active')); d.querySelector(`#program-tab .filter-btn[data-filter="${category}"]`).classList.add('active'); const searchTerm = d.getElementById('search-input').value.toLowerCase(); d.querySelectorAll('.event-result-card').forEach(card => { const categoryMatch = (category === 'all' || card.dataset.category === category); const searchMatch = (card.dataset.searchText.includes(searchTerm)); card.style.display = (categoryMatch && searchMatch) ? 'block' : 'none'; }); }
window.filterScoreboard = function(category) { if (!category) return; d.querySelectorAll('#scoreboard-filter-buttons .filter-btn').forEach(btn => btn.classList.remove('active')); const activeButton = d.querySelector(`#scoreboard-filter-buttons .filter-btn[data-filter="${category}"]`); if (activeButton) activeButton.classList.add('active'); const totalsToShow = processedScoreboardData.categoryTotals[category]; const totalCard = d.getElementById('scoreboard-total-card'); const countElement = d.getElementById('scoreboard-category-count'); if (totalCard && totalsToShow) { TEAM_NAMES.forEach(team => { const teamSpan = totalCard.querySelector(`span[data-team="${team}"]`); if (teamSpan) teamSpan.textContent = totalsToShow[team] || 0; }); } if (countElement) { const count = processedScoreboardData.categoryCounts[category] || 0; countElement.textContent = `Published Results: ${count}`; } d.querySelectorAll('#scoreboard-container .scoreboard-card:not(.total-card)').forEach(card => { const eventName = card.dataset.eventName; const eventData = eventName ? processedScoreboardData.eventPoints[eventName] : undefined; if (!eventData) { card.style.display = 'none'; return; } const eventCategory = eventData.isGroup ? 'group' : eventData.category; card.style.display = (category === eventCategory) ? 'block' : 'none'; }); }
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
// *** മാറ്റം വരുത്തി: 'participants' സ്റ്റാറ്റസ് നീക്കം ചെയ്തു ***
let loadStatus = { results: false, programs: false, teams: false, homepage: false, categories: false };
function checkAllDataLoaded() { 
    if (allDataLoaded) { 
        processAllData(); 
        return; 
    } 
    // *** മാറ്റം വരുത്തി: 'participants' സ്റ്റാറ്റസ് നീക്കം ചെയ്തു ***
    if (loadStatus.results && loadStatus.programs && loadStatus.teams && loadStatus.homepage && loadStatus.categories) { 
        allDataLoaded = true; 
        console.log("All data loaded. Processing..."); 
        processAllData(); 
    } 
}
// Firebase Listeners (തത്സമയം ഡാറ്റ ലോഡ് ചെയ്യുന്നു)
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/results`)), (snapshot) => { dbResults = {}; snapshot.docs.forEach(doc => { dbResults[doc.id] = doc.data(); }); loadStatus.results = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading results: ", e); dbResults = {}; loadStatus.results = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/programs`)), (snapshot) => { dbPrograms = {}; snapshot.docs.forEach(doc => { dbPrograms[doc.id] = doc.data(); }); loadStatus.programs = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading programs: ", e); dbPrograms = {}; loadStatus.programs = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/teams`)), (snapshot) => { dbTeams = {}; snapshot.docs.forEach(doc => { dbTeams[doc.id] = doc.data(); }); loadStatus.teams = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading teams: ", e); dbTeams = {}; loadStatus.teams = true; checkAllDataLoaded(); });
onSnapshot(doc(db, `artifacts/${appId}/public/data/config`, 'homepage'), (docSnap) => { dbHomepage = docSnap.exists() ? docSnap.data() : {}; loadStatus.homepage = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading homepage: ", e); dbHomepage = {}; loadStatus.homepage = true; checkAllDataLoaded(); });
onSnapshot(query(collection(db, `artifacts/${appId}/public/data/categories`)), (snapshot) => { dbCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.name.localeCompare(b.name)); loadStatus.categories = true; checkAllDataLoaded(); }, (e) => { console.error("Error loading categories: ", e); dbCategories = []; loadStatus.categories = true; checkAllDataLoaded(); });

// *** മാറ്റം വരുത്തി: 'participants' ലിസണർ പൂർണ്ണമായും നീക്കം ചെയ്തു ***

window.onload = function() {
    showPage('home-page'); 
    updateMenuActiveState(); 
    showMainTab('team-tab'); 
};
