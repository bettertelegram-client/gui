
    const modal = document.getElementById('modal');
    const modal_ok = document.getElementById('modal-ok');
    if (modal_ok) modal_ok.addEventListener('click', () => modal.classList.remove('show'));
    
    function show_modal(message) {
        document.getElementById('modal-message').innerHTML = message;
        modal.classList.add('show');
    }

    function format_uptime(uptime_secs) {
        const months = Math.floor(uptime_secs / (30 * 24 * 3600));
        uptime_secs %= (30 * 24 * 3600);
        const weeks = Math.floor(uptime_secs / (7 * 24 * 3600));
        uptime_secs %= (7 * 24 * 3600);
        const days = Math.floor(uptime_secs / (24 * 3600));
        uptime_secs %= (24 * 3600);
        const hours = Math.floor(uptime_secs / 3600);
        uptime_secs %= 3600;
        const minutes = Math.floor(uptime_secs / 60);
        
        let formatted_uptime = '';
        if (months > 0) formatted_uptime += `${months} month${months > 1 ? 's' : ''}, `;
        if (weeks > 0) formatted_uptime += `${weeks} wk${weeks > 1 ? 's' : ''}, `;
        if (days > 0) formatted_uptime += `${days} day${days > 1 ? 's' : ''}, `;
        if (hours > 0) formatted_uptime += `${hours} hr${hours > 1 ? 's' : ''}, `;
        if (minutes > 0) formatted_uptime += `${minutes} min${minutes > 1 ? 's' : ''}`;
        formatted_uptime = formatted_uptime.replace(/, $/, '');
    
        const formatted_time = new Date((new Date()).getTime() - uptime_secs * 1000)
            .toISOString().replace('T', ' ')
            .slice(0, 19)
            .split('-').reverse().join('-');
        formatted_uptime += ` (${formatted_time.substring(formatted_time.indexOf(' ') + 1)})`;
        return `Since ${formatted_uptime}`;
    }

    let previous_href = window.location.href, uptime_secs = parseInt(sessionStorage.getItem('srv_uptime')), refresh_ticker = 0;
    setInterval(() => {
        const current_href = window.location.href.indexOf('/') !== -1 ? window.location.href.split('/').pop() : window.location.href;
        if (current_href !== previous_href) {
            previous_href = current_href;
            switch (previous_href) {
                case 'Notes.html': {
                    var dates = [];
                    var versions = [];
                    var notes = {};
                    let currentIndex = 0;
                    const tabsContainer = document.getElementById('tabsContainer');
                    const notesList = document.getElementById('notesList');
                    const leftButton = document.getElementById('leftButton');
                    const rightButton = document.getElementById('rightButton');
                    function renderTabs() {
                        tabsContainer.innerHTML = versions
                            .map(
                                (version, index) => `
                                <div class="tab ${
                                    index === currentIndex ? 'active' : ''
                                }" data-index="${index}">
                                        <span>${version}</span>
                                        <p>${dates[index]}</p>
                                </div>
                        `
                            )
                            .join('');
                    }
    
                    function renderNotes() {
                        const currentVersion = versions[currentIndex]
                        notesList.innerHTML = notes[currentVersion]
                            .map(note => `<li>${note}</li>`)
                            .join('');
                    }
    
                    function updateButtonState(button, isEnabled) {
                        const svgPath = button.querySelector('path');
                        button.classList.toggle('active', isEnabled);
                        svgPath.setAttribute('opacity', isEnabled ? '1' : '0.25');
                    }
    
                    function updateButtonVisibility() {
                        updateButtonState(leftButton, currentIndex > 0);
                        updateButtonState(rightButton, currentIndex < versions.length - 1);
                    }
    
                    tabsContainer.addEventListener('click', e => {
                        const tab = e.target.closest('.tab');
                        if (tab) {
                            currentIndex = parseInt(tab.dataset.index);
                            renderTabs();
                            renderNotes();
                            updateButtonVisibility();
                        }
                    });
    
                    leftButton.addEventListener('click', () => {
                        if (currentIndex > 0) {
                            --currentIndex;
                            renderTabs();
                            renderNotes();
                        }
                        updateButtonVisibility();
                    });
    
                    rightButton.addEventListener('click', () => {
                        if (currentIndex < versions.length - 1) {
                            ++currentIndex;
                            renderTabs();
                            renderNotes();
                        }
                        updateButtonVisibility();
                    });
    
                    fetch('https://bettertelegram.com/release_notes', { method: 'GET' })
                    .then(response => response.json())
                    .then(json => {
                        if (json.err === 0) {
                            const data = JSON.parse(json.rel_info);
                            console.dir(data);
                            versions = data.versions;
                            notes = data.notes;
                            dates = data.dates;
                            renderTabs();
                            renderNotes();
                            updateButtonVisibility();
                        }
                    })
                    .catch(error => {
                        console.error('error:', error);
                    });
                } break;
                case 'Setting.html': {
                    const licence_key = document.getElementById('licence_key_text');
                    const licence_day = document.getElementById('licence_day_text');
                    if (licence_key && licence_day) {
                        licence_key.innerHTML = sessionStorage.getItem('licence_key').replace(/(\d{4})(?=\d)/g, '$1 ');
                        licence_day.innerHTML = sessionStorage.getItem('licence_days');
                    }
                } break;
                case 'About.html': {
                    const app_version = document.getElementById('app_version');
                    const dll_version = document.getElementById('dll_version');
                    if (app_version && dll_version) {
                        app_version.innerHTML = sessionStorage.getItem('app_version');
                        dll_version.innerHTML = sessionStorage.getItem('dll_version');
                    }
                } break;
                case 'Home.html': {
                    const loading_container = document.querySelector('.loading-container.login-loading');
                    if (loading_container) {
                        const shown = sessionStorage.getItem('homePlaneShown') === 'true';
                        if (shown) {
                            loading_container.style.display = 'none';
                            const home_el = document.querySelector('.home');
                            if (home_el) { home_el.style.animation = 'none'; home_el.style.opacity = '1'; }
                            const phone_el = document.querySelector('.phoneMenu');
                            if (phone_el) { phone_el.style.animation = 'none'; phone_el.style.opacity = '1'; }
                        } else sessionStorage.setItem('homePlaneShown', 'true');
                    }
                    if (sessionStorage.getItem('licence_days') <= 0) {
                        setTimeout(() => 
                            show_modal('Please note that there are no days remaining on your licence. If you wish to continue using BetterTelegram, then head over to the settings page & add more days to your licence. </br> Thank you!'), 3333);
                    }
                } break;
                case 'Plugins.html': {
                    const otr_plugin = document.querySelector('.plugin-toggle-otr');
                    if (otr_plugin) {
                        const should_enable = sessionStorage.getItem('plugin-otr') == 1;
                        if (should_enable) otr_plugin.classList.add('active');
                        otr_plugin.checked = should_enable;
                    }
                    const ghost_plugin = document.querySelector('.plugin-toggle-ghost');
                    if (ghost_plugin) {
                        const should_enable = sessionStorage.getItem('plugin-ghost') == 1;
                        if (should_enable) ghost_plugin.classList.add('active');
                        ghost_plugin.checked = should_enable;
                    }
                    const purge_plugin = document.querySelector('.plugin-toggle-purge');
                    if (purge_plugin) {
                        const should_enable = sessionStorage.getItem('plugin-purge') == 1;
                        if (should_enable) purge_plugin.classList.add('active');
                        purge_plugin.checked = should_enable;
                    }
                } break;
            }
        }
        if (refresh_ticker >= 10) {
            const srv_uptime = document.getElementById('uptime_date');
            if (srv_uptime) srv_uptime.innerHTML = format_uptime(uptime_secs);
            refresh_ticker = 0;
        } else
        ++refresh_ticker;
    }, 33);

