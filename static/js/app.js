/**
 * BigQuery Release Notes Client Application
 * Handles fetching, caching, real-time filtering, search, and X (Twitter) composition.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let releaseData = [];
    let activeFilter = 'all';
    let searchQuery = '';
    let selectedUpdate = null;

    // DOM Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const btnRefreshText = document.getElementById('btn-refresh-text');
    const btnExportCSV = document.getElementById('btn-export-csv');
    const syncText = document.getElementById('sync-text');
    const syncIndicator = document.getElementById('sync-indicator');
    
    // Stats cards
    const statCards = {
        all: document.getElementById('stat-card-all'),
        feature: document.getElementById('stat-card-feature'),
        announcement: document.getElementById('stat-card-announcement'),
        breaking: document.getElementById('stat-card-breaking'),
        issue: document.getElementById('stat-card-issue'),
        change: document.getElementById('stat-card-change')
    };

    const countEls = {
        all: document.getElementById('count-all'),
        feature: document.getElementById('count-feature'),
        announcement: document.getElementById('count-announcement'),
        breaking: document.getElementById('count-breaking'),
        issue: document.getElementById('count-issue'),
        change: document.getElementById('count-change')
    };

    // Filter controls & Feed status
    const searchBox = document.getElementById('search-box');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const containerActiveFilters = document.getElementById('container-active-filters');
    const txtActiveFilterName = document.getElementById('txt-active-filter-name');
    const btnRemoveFilter = document.getElementById('btn-remove-filter');
    const btnResetFilters = document.getElementById('btn-reset-filters');
    
    const feedLoader = document.getElementById('feed-loader');
    const feedEmptyState = document.getElementById('feed-empty-state');
    const notesTimeline = document.getElementById('notes-timeline-container');
    
    // Tweet Composer Drawer
    const tweetDrawer = document.getElementById('tweet-composer-drawer');
    const overlayDrawer = document.getElementById('overlay-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const previewUpdateType = document.getElementById('preview-update-type');
    const previewUpdateDate = document.getElementById('preview-update-date');
    const previewUpdateText = document.getElementById('preview-update-text');
    
    const tweetTextarea = document.getElementById('tweet-textarea');
    const lblCharCounter = document.getElementById('lbl-char-counter');
    const btnAutocut = document.getElementById('btn-autocut');
    const btnCopyTweet = document.getElementById('btn-copy-tweet');
    const btnPostTweet = document.getElementById('btn-post-tweet');
    const txtCopyBtn = document.getElementById('txt-copy-btn');

    // -------------------------------------------------------------
    // Initialization & Data Fetching
    // -------------------------------------------------------------
    
    async function loadReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const result = await response.json();
            if (result.success) {
                releaseData = result.data;
                updateSyncStatus(result.source, result.last_updated);
                calculateStats();
                renderFeed();
            } else {
                showError(result.error || "Failed to retrieve release notes.");
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showError(error.message || "Network error occurred.");
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        if (isLoading) {
            btnRefresh.classList.add('loading');
            btnRefresh.disabled = true;
            btnRefreshText.textContent = "Syncing...";
            if (btnExportCSV) btnExportCSV.disabled = true;
            feedLoader.style.display = 'flex';
            notesTimeline.style.display = 'none';
            feedEmptyState.style.display = 'none';
        } else {
            btnRefresh.classList.remove('loading');
            btnRefresh.disabled = false;
            btnRefreshText.textContent = "Refresh Feed";
            if (btnExportCSV) btnExportCSV.disabled = false;
            feedLoader.style.display = 'none';
        }
    }

    function updateSyncStatus(source, time) {
        if (source === 'live') {
            syncIndicator.className = 'status-indicator live';
            syncText.textContent = `Live Synced at ${time}`;
        } else {
            syncIndicator.className = 'status-indicator cache';
            syncText.textContent = `Cached (Synced at ${time})`;
        }
    }

    function showError(message) {
        syncIndicator.className = 'status-indicator';
        syncText.textContent = `Sync Error: ${message}`;
        syncText.style.color = '#ef4444';
        
        feedEmptyState.style.display = 'flex';
        document.getElementById('txt-empty-title').textContent = "Sync Failure";
        document.getElementById('txt-empty-desc').textContent = `We couldn't connect to Google Cloud's RSS feed. Error details: ${message}`;
    }

    // -------------------------------------------------------------
    // Statistics & Calculations
    // -------------------------------------------------------------

    function calculateStats() {
        const counts = { all: 0, feature: 0, announcement: 0, breaking: 0, issue: 0, change: 0 };
        
        releaseData.forEach(entry => {
            entry.updates.forEach(update => {
                counts.all++;
                const type = update.type.toLowerCase();
                if (type.includes('feature')) counts.feature++;
                else if (type.includes('announcement')) counts.announcement++;
                else if (type.includes('breaking')) counts.breaking++;
                else if (type.includes('issue')) counts.issue++;
                else if (type.includes('change')) counts.change++;
            });
        });

        // Update counts in DOM
        Object.keys(counts).forEach(key => {
            if (countEls[key]) {
                countEls[key].textContent = counts[key];
            }
        });
    }

    // -------------------------------------------------------------
    // Filtering & Search Processing
    // -------------------------------------------------------------

    function applyFilter(category) {
        activeFilter = category;
        
        // Update dashboard active states
        Object.keys(statCards).forEach(key => {
            if (key === category) {
                statCards[key].classList.add('active');
            } else {
                statCards[key].classList.remove('active');
            }
        });

        // Show/hide active filter badge
        if (category === 'all') {
            containerActiveFilters.style.display = 'none';
        } else {
            containerActiveFilters.style.display = 'flex';
            txtActiveFilterName.textContent = getFriendlyCategoryName(category);
        }

        renderFeed();
    }

    function getFriendlyCategoryName(category) {
        if (category === 'all') return 'All';
        if (category === 'breaking') return 'Breaking Changes';
        return category.charAt(0).toUpperCase() + category.slice(1) + 's';
    }

    function handleSearch(query) {
        searchQuery = query.toLowerCase().stripHTML().trim();
        if (searchQuery) {
            btnClearSearch.style.display = 'block';
        } else {
            btnClearSearch.style.display = 'none';
        }
        renderFeed();
    }

    // Utility to strip HTML tags from a string
    String.prototype.stripHTML = function() {
        return this.replace(/<[^>]*>/g, '');
    };

    // -------------------------------------------------------------
    // DOM Rendering Engine
    // -------------------------------------------------------------

    function renderFeed() {
        notesTimeline.innerHTML = '';
        let matchedUpdateCount = 0;

        releaseData.forEach(entry => {
            // Filter the updates in this entry
            const filteredUpdates = entry.updates.filter(update => {
                // Category Filter Check
                if (activeFilter !== 'all') {
                    const updateType = update.type.toLowerCase();
                    if (activeFilter === 'feature' && !updateType.includes('feature')) return false;
                    if (activeFilter === 'announcement' && !updateType.includes('announcement')) return false;
                    if (activeFilter === 'breaking' && !updateType.includes('breaking')) return false;
                    if (activeFilter === 'issue' && !updateType.includes('issue')) return false;
                    if (activeFilter === 'change' && !updateType.includes('change') && !updateType.includes('breaking')) return false;
                }

                // Search Box Check
                if (searchQuery) {
                    const descText = update.description.toLowerCase().stripHTML();
                    const typeText = update.type.toLowerCase();
                    const dateText = entry.date.toLowerCase();
                    
                    const matchesDesc = descText.includes(searchQuery);
                    const matchesType = typeText.includes(searchQuery);
                    const matchesDate = dateText.includes(searchQuery);
                    
                    if (!matchesDesc && !matchesType && !matchesDate) return false;
                }

                return true;
            });

            if (filteredUpdates.length > 0) {
                matchedUpdateCount += filteredUpdates.length;

                // Create Date Group Container
                const dateGroup = document.createElement('div');
                dateGroup.className = 'date-group';
                
                // Group Header (Node + Date Title)
                const dateHeader = document.createElement('div');
                dateHeader.className = 'date-header';
                
                const dateNode = document.createElement('div');
                dateNode.className = 'date-node';
                dateNode.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                `;
                
                const dateTitle = document.createElement('h3');
                dateTitle.className = 'date-title';
                dateTitle.textContent = entry.date;
                
                dateHeader.appendChild(dateNode);
                dateHeader.appendChild(dateTitle);
                dateGroup.appendChild(dateHeader);

                // Group Updates Container
                const dateUpdates = document.createElement('div');
                dateUpdates.className = 'date-updates';

                // Append Updates
                filteredUpdates.forEach(update => {
                    const updateCard = document.createElement('div');
                    updateCard.className = 'update-card';
                    updateCard.id = `card-${update.id}`;
                    if (selectedUpdate && selectedUpdate.id === update.id) {
                        updateCard.classList.add('selected');
                    }

                    // Card Header
                    const cardHeader = document.createElement('div');
                    cardHeader.className = 'card-header';

                    const badgeAndLabel = document.createElement('div');
                    badgeAndLabel.className = 'badge-and-label';

                    const badge = document.createElement('span');
                    const normalizedType = update.type.toLowerCase().replace(/\s+/g, '-');
                    badge.className = `badge ${normalizedType}`;
                    badge.textContent = update.type;

                    badgeAndLabel.appendChild(badge);
                    
                    const cardActions = document.createElement('div');
                    cardActions.className = 'card-actions';

                    const btnTweet = document.createElement('button');
                    btnTweet.className = 'btn-card-tweet';
                    btnTweet.id = `btn-tweet-${update.id}`;
                    btnTweet.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    `;

                    btnTweet.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openTweetComposer(update, entry);
                    });

                    cardActions.appendChild(btnTweet);

                    // Copy to clipboard card action button
                    const btnCopy = document.createElement('button');
                    btnCopy.className = 'btn-card-copy';
                    btnCopy.id = `btn-copy-${update.id}`;
                    btnCopy.title = "Copy to Clipboard";
                    btnCopy.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    `;

                    btnCopy.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        const cleanText = update.description.stripHTML();
                        try {
                            await navigator.clipboard.writeText(cleanText);
                            const copySpan = btnCopy.querySelector('span');
                            copySpan.textContent = 'Copied!';
                            btnCopy.classList.add('copied');
                            setTimeout(() => {
                                copySpan.textContent = 'Copy';
                                btnCopy.classList.remove('copied');
                            }, 2000);
                        } catch (err) {
                            console.error('Could not copy text: ', err);
                            // Fallback
                            const tempInput = document.createElement('textarea');
                            tempInput.value = cleanText;
                            document.body.appendChild(tempInput);
                            tempInput.select();
                            document.execCommand('copy');
                            document.body.removeChild(tempInput);
                            const copySpan = btnCopy.querySelector('span');
                            copySpan.textContent = 'Copied!';
                            btnCopy.classList.add('copied');
                            setTimeout(() => {
                                copySpan.textContent = 'Copy';
                                btnCopy.classList.remove('copied');
                            }, 2000);
                        }
                    });

                    cardActions.appendChild(btnCopy);
                    
                    cardHeader.appendChild(badgeAndLabel);
                    cardHeader.appendChild(cardActions);

                    // Card Body (Description HTML)
                    const cardBody = document.createElement('div');
                    cardBody.className = 'card-body';
                    cardBody.innerHTML = update.description;

                    // Support selecting the card
                    updateCard.addEventListener('click', () => {
                        selectCard(updateCard, update, entry);
                    });

                    updateCard.appendChild(cardHeader);
                    updateCard.appendChild(cardBody);
                    dateUpdates.appendChild(updateCard);
                });

                dateGroup.appendChild(dateUpdates);
                notesTimeline.appendChild(dateGroup);
            }
        });

        // Toggle visibility based on matching counts
        if (matchedUpdateCount === 0) {
            notesTimeline.style.display = 'none';
            feedEmptyState.style.display = 'flex';
        } else {
            notesTimeline.style.display = 'block';
            feedEmptyState.style.display = 'none';
        }
    }

    function selectCard(cardElement, update, entry) {
        // Toggle selected state
        const isCurrentlySelected = cardElement.classList.contains('selected');
        
        // Reset other selected cards
        document.querySelectorAll('.update-card').forEach(el => el.classList.remove('selected'));
        
        if (!isCurrentlySelected) {
            cardElement.classList.add('selected');
            selectedUpdate = update;
            openTweetComposer(update, entry);
        } else {
            selectedUpdate = null;
            closeTweetComposer();
        }
    }

    // -------------------------------------------------------------
    // Tweet Share Engine
    // -------------------------------------------------------------

    function openTweetComposer(update, entry) {
        selectedUpdate = update;
        
        // Highlight selection in case clicked from Tweet button
        document.querySelectorAll('.update-card').forEach(el => el.classList.remove('selected'));
        const card = document.getElementById(`card-${update.id}`);
        if (card) card.classList.add('selected');

        // Setup preview details
        previewUpdateType.className = `badge ${update.type.toLowerCase().replace(/\s+/g, '-')}`;
        previewUpdateType.textContent = update.type;
        previewUpdateDate.textContent = entry.date;
        
        const cleanText = update.description.stripHTML();
        previewUpdateText.textContent = cleanText;

        // Generate Tweet Text template
        const tweetText = generateTweetTemplate(update, entry);
        tweetTextarea.value = tweetText;
        
        updateCharacterCount();

        // Slide out drawer
        tweetDrawer.classList.add('open');
        overlayDrawer.classList.add('open');
    }

    function closeTweetComposer() {
        tweetDrawer.classList.remove('open');
        overlayDrawer.classList.remove('open');
        
        // Reset card selection styling
        document.querySelectorAll('.update-card').forEach(el => el.classList.remove('selected'));
        selectedUpdate = null;
    }

    function generateTweetTemplate(update, entry) {
        // Emoji map for categories
        const emojis = {
            'feature': '🚀',
            'announcement': '📢',
            'breaking': '⚠️',
            'issue': '🐞',
            'change': '🔄',
            'general': '💡'
        };

        const typeLower = update.type.toLowerCase();
        let emoji = '💡';
        
        for (const [key, val] of Object.entries(emojis)) {
            if (typeLower.includes(key)) {
                emoji = val;
                break;
            }
        }

        const cleanDesc = update.description.stripHTML().replace(/\s+/g, ' ').trim();
        const date = entry.date;
        const link = entry.link || 'https://cloud.google.com/bigquery/docs/release-notes';
        
        // Format layout: [Emoji] BigQuery [Type] ([Date]): [Text]
        // [Link] #GoogleCloud #BigQuery
        const header = `${emoji} BigQuery ${update.type} (${date}):\n\n`;
        const footer = `\n\nRead more: ${link}\n#GoogleCloud #BigQuery`;
        
        // Calculate room for content text
        const maxContentLen = 280 - (header.length + footer.length);
        let textPart = cleanDesc;
        
        if (cleanDesc.length > maxContentLen) {
            textPart = cleanDesc.substring(0, maxContentLen - 3) + '...';
        }

        return `${header}${textPart}${footer}`;
    }

    function updateCharacterCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        lblCharCounter.textContent = `${count} / 280`;

        if (count > 280) {
            lblCharCounter.className = 'character-counter danger';
            btnPostTweet.disabled = true;
            btnPostTweet.style.opacity = '0.5';
            btnPostTweet.style.cursor = 'not-allowed';
        } else if (count > 250) {
            lblCharCounter.className = 'character-counter warning';
            btnPostTweet.disabled = false;
            btnPostTweet.style.opacity = '1';
            btnPostTweet.style.cursor = 'pointer';
        } else {
            lblCharCounter.className = 'character-counter';
            btnPostTweet.disabled = false;
            btnPostTweet.style.opacity = '1';
            btnPostTweet.style.cursor = 'pointer';
        }
    }

    function autoFitTweet() {
        if (!selectedUpdate) return;
        
        const text = tweetTextarea.value;
        if (text.length <= 280) return; // No need to crop

        const emojis = {
            'feature': '🚀', 'announcement': '📢', 'breaking': '⚠️',
            'issue': '🐞', 'change': '🔄', 'general': '💡'
        };

        const typeLower = selectedUpdate.type.toLowerCase();
        let emoji = '💡';
        for (const [key, val] of Object.entries(emojis)) {
            if (typeLower.includes(key)) { emoji = val; break; }
        }

        const date = previewUpdateDate.textContent;
        // Search in releaseData to find link
        const entry = releaseData.find(e => e.date === date);
        const link = entry ? entry.link : 'https://cloud.google.com/bigquery/docs/release-notes';
        
        const header = `${emoji} BigQuery ${selectedUpdate.type} (${date}):\n\n`;
        const footer = `\n\nRead more: ${link}\n#GoogleCloud #BigQuery`;

        const maxContentLen = 280 - (header.length + footer.length);
        const cleanDesc = selectedUpdate.description.stripHTML().replace(/\s+/g, ' ').trim();
        
        if (maxContentLen > 0) {
            const trimmedDesc = cleanDesc.substring(0, maxContentLen - 3) + '...';
            tweetTextarea.value = `${header}${trimmedDesc}${footer}`;
            updateCharacterCount();
        }
    }

    // -------------------------------------------------------------
    // Event Listeners Binding
    // -------------------------------------------------------------

    // Sync button
    btnRefresh.addEventListener('click', () => {
        loadReleaseNotes(true);
    });

    // Stats category selectors
    Object.keys(statCards).forEach(key => {
        statCards[key].addEventListener('click', () => {
            applyFilter(key);
        });
    });

    // Search bar typing (Debounced to improve performance)
    let searchTimeout;
    searchBox.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            handleSearch(e.target.value);
        }, 200);
    });

    // Clear search keyword
    btnClearSearch.addEventListener('click', () => {
        searchBox.value = '';
        handleSearch('');
        searchBox.focus();
    });

    // Active Filter Badge Close
    btnRemoveFilter.addEventListener('click', () => {
        applyFilter('all');
    });

    // Empty state reset button
    btnResetFilters.addEventListener('click', () => {
        searchBox.value = '';
        searchQuery = '';
        btnClearSearch.style.display = 'none';
        applyFilter('all');
    });

    // Drawer close binds
    btnCloseDrawer.addEventListener('click', closeTweetComposer);
    overlayDrawer.addEventListener('click', closeTweetComposer);
    
    // Keypress esc for drawer close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeTweetComposer();
        }
    });

    // Tweet text modification counter
    tweetTextarea.addEventListener('input', updateCharacterCount);

    // Auto-fit button click
    btnAutocut.addEventListener('click', autoFitTweet);

    // Copy Tweet Content to clipboard
    btnCopyTweet.addEventListener('click', async () => {
        const text = tweetTextarea.value;
        try {
            await navigator.clipboard.writeText(text);
            txtCopyBtn.textContent = 'Copied!';
            btnCopyTweet.classList.add('copied');
            setTimeout(() => {
                txtCopyBtn.textContent = 'Copy Text';
                btnCopyTweet.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Could not copy text: ', err);
            // Fallback for older browsers
            tweetTextarea.select();
            document.execCommand('copy');
            txtCopyBtn.textContent = 'Copied!';
            setTimeout(() => {
                txtCopyBtn.textContent = 'Copy Text';
            }, 2000);
        }
    });

    // Send tweet intent trigger
    btnPostTweet.addEventListener('click', () => {
        const text = encodeURIComponent(tweetTextarea.value);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${text}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    });

    // Export to CSV function
    function exportToCSV() {
        if (!releaseData || releaseData.length === 0) {
            alert('No data available to export.');
            return;
        }

        // CSV headers
        const headers = ['Date', 'Type', 'Description', 'Link'];
        const csvRows = [headers.join(',')];

        releaseData.forEach(entry => {
            // Apply current filters to export matching entries
            const filteredUpdates = entry.updates.filter(update => {
                if (activeFilter !== 'all') {
                    const updateType = update.type.toLowerCase();
                    if (activeFilter === 'feature' && !updateType.includes('feature')) return false;
                    if (activeFilter === 'announcement' && !updateType.includes('announcement')) return false;
                    if (activeFilter === 'breaking' && !updateType.includes('breaking')) return false;
                    if (activeFilter === 'issue' && !updateType.includes('issue')) return false;
                    if (activeFilter === 'change' && !updateType.includes('change') && !updateType.includes('breaking')) return false;
                }

                if (searchQuery) {
                    const descText = update.description.toLowerCase().stripHTML();
                    const typeText = update.type.toLowerCase();
                    const dateText = entry.date.toLowerCase();
                    
                    const matchesDesc = descText.includes(searchQuery);
                    const matchesType = typeText.includes(searchQuery);
                    const matchesDate = dateText.includes(searchQuery);
                    
                    if (!matchesDesc && !matchesType && !matchesDate) return false;
                }

                return true;
            });

            filteredUpdates.forEach(update => {
                const cleanDesc = update.description.stripHTML().replace(/\s+/g, ' ').replace(/"/g, '""').trim();
                const cleanDate = entry.date.replace(/"/g, '""');
                const cleanType = update.type.replace(/"/g, '""');
                const cleanLink = (entry.link || 'https://cloud.google.com/bigquery/docs/release-notes').replace(/"/g, '""');

                const row = [
                    `"${cleanDate}"`,
                    `"${cleanType}"`,
                    `"${cleanDesc}"`,
                    `"${cleanLink}"`
                ];
                csvRows.push(row.join(','));
            });
        });

        if (csvRows.length <= 1) {
            alert('No matching records found to export.');
            return;
        }

        const blob = new Blob([csvRows.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            
            const timestamp = new Date().toISOString().slice(0, 10);
            const filterName = activeFilter !== 'all' ? `_${activeFilter}` : '';
            link.setAttribute("download", `bigquery_releases_${timestamp}${filterName}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Bind CSV Export click handler
    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', exportToCSV);
    }

    // -------------------------------------------------------------
    // Initial Load execution
    // -------------------------------------------------------------
    loadReleaseNotes(false);
});
