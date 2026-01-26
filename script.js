mapboxgl.accessToken = 'pk.eyJ1IjoiYW1hY2JldGgxIiwiYSI6ImNtZzB0MGd0ZjBqMDEybHIzbnU0dzFuam4ifQ.aGD0Ws8Zut0q4f1iTYUBeA';
let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/amacbeth1/cmk44u6xk00ka01s90foffz39',
    center: [4.9041, 52.3676],
    zoom: 12
});

let currentFeature = null;
let geolocateControl = null;
let locationsData = null;
let currentFilters = {};

// Load GeoJSON data
async function loadLocationsData() {
    try {
        const response = await fetch('locations.geojson');
        locationsData = await response.json();
        console.log('Locations data loaded:', locationsData.features.length, 'locations');
    } catch (error) {
        console.error('Failed to load locations data:', error);
    }
}

// Calculate distance between two coordinates (Haversine formula)
function getDistance(point1, point2) {
    const R = 6371; // Earth's radius in km
    const lat1 = point1[1] * Math.PI / 180;
    const lat2 = point2[1] * Math.PI / 180;
    const deltaLat = (point2[1] - point1[1]) * Math.PI / 180;
    const deltaLon = (point2[0] - point1[0]) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
}

// Check if feature matches current filters
function matchesCurrentFilters(feature) {
    if (Object.keys(currentFilters).length === 0) return true;
    
    for (const filterType in currentFilters) {
        const allowedValues = currentFilters[filterType];
        const featureValue = feature.properties[filterType];
        
        // Special handling for age filters (TRUE/FALSE values)
        if (filterType.startsWith('age_') || filterType === 'toilet' || filterType === 'changing_table') {
            if (!allowedValues.includes(featureValue)) {
                return false;
            }
        } else {
            // For category and weather filters
            if (!allowedValues.includes(featureValue)) {
                return false;
            }
        }
    }
    
    return true;
}

// Create HTML for a single list item - MORE EXPANSIVE
function createListItem(feature, distance) {
    const name = feature.properties.name_en || feature.properties.Name || 'No Name';
    const category = feature.properties.secondary_category || feature.properties.primary_category || feature.properties.category || 'N/A';
    const desc = feature.properties.description || '';
    
    const ages = [];
    if (feature.properties.age_small === 'TRUE') ages.push('👶 Babies');
    if (feature.properties.age_medium === 'TRUE') ages.push('👦 Toddlers');
    if (feature.properties.age_large === 'TRUE') ages.push('👧 Big Kids');
    
    const weatherMap = {
        'Indoor': '☔ Indoor',
        'Outdoor': '☀️ Outdoor', 
        'Mixed': '☀️☔ Any Weather'
    };
    const weather = feature.properties.indoor_outdoor ? weatherMap[feature.properties.indoor_outdoor] : '';
    
    const distanceText = distance < 1 
        ? `${Math.round(distance * 1000)}m away` 
        : `${distance.toFixed(1)}km away`;
    
    // Truncate description for list view
    const shortDesc = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
    
    // Store feature data with a unique ID for click handling
    const itemId = `list-item-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the feature in a global map for retrieval
    if (!window.listItemFeatures) {
        window.listItemFeatures = new Map();
    }
    window.listItemFeatures.set(itemId, feature);
    
    return `
        <div class="list-item" data-item-id="${itemId}">
            <div class="list-item-header">
                <h4>${name}</h4>
                <span class="list-distance">${distanceText}</span>
            </div>
            
            <div class="list-item-category">
                <span class="list-category-badge">${category}</span>
            </div>
            
            ${shortDesc ? `<p class="list-description">${shortDesc}</p>` : ''}
            
            <div class="list-item-tags">
                ${ages.length > 0 ? `<div class="list-tag-group">
                    ${ages.map(age => `<span class="list-tag">${age}</span>`).join('')}
                </div>` : ''}
                
                ${weather ? `<span class="list-tag list-tag-weather">${weather}</span>` : ''}
            </div>
        </div>
    `;
}

// Build and render the locations list
function buildLocationsList() {
    if (!locationsData) {
        console.warn('No locations data available');
        return;
    }
    
    const userLocation = geolocateControl?._lastKnownPosition;
    const centerPoint = userLocation 
        ? [userLocation.coords.longitude, userLocation.coords.latitude]
        : [4.9041, 52.3676]; // Amsterdam center
    
    // Filter features based on current filters
    let features = locationsData.features.filter(feature => matchesCurrentFilters(feature));
    
    // Calculate distances and sort
    const featuresWithDistance = features.map(feature => ({
        feature,
        distance: getDistance(centerPoint, feature.geometry.coordinates)
    }));
    
    featuresWithDistance.sort((a, b) => a.distance - b.distance);
    
    // Render list
    const container = document.getElementById('list-items');
    
    if (featuresWithDistance.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #666;">
                <p>No locations match your current filters.</p>
                <button onclick="window.resetFilters()" style="margin-top: 12px; padding: 10px 20px; background: #4daabb; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Reset Filters
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = featuresWithDistance
        .map(item => createListItem(item.feature, item.distance))
        .join('');
    
    // Add click handlers to all list items
    container.querySelectorAll('.list-item').forEach(item => {
        item.addEventListener('click', function() {
            const itemId = this.dataset.itemId;
            const feature = window.listItemFeatures.get(itemId);
            if (feature) {
                window.openFromList(feature);
            }
        });
    });
    
    // Update count in header
    const countElement = document.getElementById('list-count');
    if (countElement) {
        countElement.textContent = `${featuresWithDistance.length} location${featuresWithDistance.length !== 1 ? 's' : ''}`;
    }
}

// Toggle list view
window.toggleListView = function() {
    const listView = document.getElementById('list-view');
    const backdrop = document.getElementById('list-backdrop');
    
    const isActive = listView.classList.contains('active');
    
    if (isActive) {
        listView.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        // Build/refresh list when opening
        buildLocationsList();
        listView.classList.add('active');
        backdrop.classList.add('active');
    }
};

// Open location from list
window.openFromList = function(feature) {
    console.log('Opening from list:', feature);
    
    // Store that we came from list
    sessionStorage.setItem('returnToList', 'true');
    const listItems = document.getElementById('list-items');
    if (listItems) {
        sessionStorage.setItem('listScrollPosition', listItems.scrollTop.toString());
    }
    
    // Close list view immediately
    const listView = document.getElementById('list-view');
    const listBackdrop = document.getElementById('list-backdrop');
    listView.classList.remove('active');
    listBackdrop.classList.remove('active');
    
    // Wait for list to close, then open location sheet
    setTimeout(() => {
        window.openLocationSheet(feature);
    }, 150);
};

// Toggle filter drawer
window.toggleFilterDrawer = function() {
    const drawer = document.getElementById('filter-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    
    const isActive = drawer.classList.contains('active');
    
    if (isActive) {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
        
        // Check if we should return to list view
        if (sessionStorage.getItem('returnToListFromFilters') === 'true') {
            sessionStorage.removeItem('returnToListFromFilters');
            
            setTimeout(() => {
                const listView = document.getElementById('list-view');
                const listBackdrop = document.getElementById('list-backdrop');
                listView.classList.add('active');
                listBackdrop.classList.add('active');
                
                // Restore scroll position
                const scrollPos = sessionStorage.getItem('listScrollPosition');
                if (scrollPos) {
                    document.getElementById('list-items').scrollTop = parseInt(scrollPos);
                    sessionStorage.removeItem('listScrollPosition');
                }
            }, 100);
        }
    } else {
        drawer.classList.add('active');
        backdrop.classList.add('active');
    }
};

// Open filters from list view
window.openFiltersFromList = function() {
    // Store that we came from list
    sessionStorage.setItem('returnToListFromFilters', 'true');
    const listItems = document.getElementById('list-items');
    if (listItems) {
        sessionStorage.setItem('listScrollPosition', listItems.scrollTop.toString());
    }
    
    // Close list view
    const listView = document.getElementById('list-view');
    const listBackdrop = document.getElementById('list-backdrop');
    listView.classList.remove('active');
    listBackdrop.classList.remove('active');
    
    // Open filter drawer
    setTimeout(() => {
        window.toggleFilterDrawer();
    }, 100);
};

// Highlight selected location
function highlightSelectedLocation(layerId, featureId) {
    // Check if layers exist before trying to modify them
    if (!map.getLayer('Icons') && !map.getLayer('Dots')) {
        console.warn('Map layers not ready yet');
        return;
    }
    
    try {
        if (map.getLayer('Icons')) {
            map.setPaintProperty('Icons', 'icon-opacity', [
                'case',
                ['==', ['get', 'id'], featureId],
                1,
                ['==', ['get', 'name_en'], featureId],
                1,
                ['==', ['get', 'Name'], featureId],
                1,
                0.5
            ]);
        }
    } catch (e) {
        console.warn('Error highlighting Icons layer:', e);
    }
    
    try {
        if (map.getLayer('Dots')) {
            map.setPaintProperty('Dots', 'icon-opacity', [
                'case',
                ['==', ['get', 'id'], featureId],
                1,
                ['==', ['get', 'name_en'], featureId],
                1,
                ['==', ['get', 'Name'], featureId],
                1,
                0.5
            ]);
        }
    } catch (e) {
        console.warn('Error highlighting Dots layer:', e);
    }
}

// Build location sheet content HTML
function buildSheetContent(f) {
    const name = f.properties.name_en || f.properties.Name || 'No Name';
    const category = f.properties.secondary_category || f.properties.primary_category || f.properties.category || 'N/A';
    const desc = f.properties.description || '';
    
    const ages = [];
    if (f.properties.age_small === 'TRUE') ages.push('👶 Babies (0-2)');
    if (f.properties.age_medium === 'TRUE') ages.push('👦 Toddlers (3-6)');
    if (f.properties.age_large === 'TRUE') ages.push('👧 Big Kids (7-12)');
    
    const weatherMap = {
        'Indoor': '☔ Rainy Days',
        'Outdoor': '☀️ Sunny Days', 
        'Mixed': '☀️☔ Any Weather'
    };
    const weather = f.properties.indoor_outdoor ? weatherMap[f.properties.indoor_outdoor] || weatherMap.Mixed : '';

    const seasonalMonths = f.properties.seasonal_months?.trim();
    const seasonalInfo = seasonalMonths ? `Open seasonally from ${seasonalMonths}` : '';
    
    const website = f.properties.website?.trim();
    const googleMaps = f.properties.google_maps?.trim();
    
    return {
        name,
        category,
        desc,
        ages,
        weather,
        seasonalInfo,
        website,
        googleMaps
    };
}

// Open location sheet
window.openLocationSheet = function(feature) {
    console.log('openLocationSheet called with:', feature);
    
    currentFeature = feature;
    const data = buildSheetContent(feature);
    const coords = feature.geometry.coordinates;
    
    console.log('Coordinates:', coords);
    console.log('Built sheet content:', data);
    
    const featureId = feature.properties.id || feature.properties.name_en || feature.properties.Name;
    
    // Don't try to highlight - just skip this for list-opened items
    // Only highlight if feature has a layer (came from map click)
    if (feature.layer) {
        const layerId = feature.layer.id;
        highlightSelectedLocation(layerId, featureId);
    }
    
    const isMobile = window.innerWidth <= 600;
    
    if (isMobile) {
        const totalHeight = window.innerHeight;
        const headerHeight = 50;
        const sheetHeight = totalHeight * 0.42; // Changed from 0.33 to 0.42 (split difference between 0.33 and 0.5)
        const offsetY = -(sheetHeight / 2);
        
        const targetZoom = Math.min(Math.max(map.getZoom(), 13), 14);
        
        console.log('Panning map to:', coords);
        
        map.easeTo({
            center: coords,
            zoom: targetZoom,
            offset: [0, offsetY],
            duration: 600
        });
        
        // Mobile sheet with new structure
        const sheet = document.getElementById('mobile-sheet');
        const backdrop = document.getElementById('sheet-backdrop');
        const title = document.getElementById('mobile-sheet-title');
        const content = document.getElementById('mobile-sheet-content');
        const websiteBtn = document.getElementById('mobile-website-btn');
        const mapsBtn = document.getElementById('mobile-maps-btn');
        
        console.log('Building mobile sheet content...');
        
        // Set title in header
        title.textContent = data.name;
        
        // Handle website button
        if (data.website) {
            const href = data.website.match(/^https?:\/\//i) ? data.website : `https://${data.website}`;
            websiteBtn.style.display = 'flex';
            websiteBtn.onclick = () => window.open(href, '_blank', 'noopener,noreferrer');
        } else {
            websiteBtn.style.display = 'none';
        }
        
        // Handle maps button
        if (data.googleMaps) {
            mapsBtn.style.display = 'flex';
            mapsBtn.onclick = () => window.open(data.googleMaps, '_blank', 'noopener,noreferrer');
        } else {
            mapsBtn.style.display = 'none';
        }
        
        // Build content (without title and links)
        let contentHTML = `<span class="category-badge">${data.category}</span>`;
        
        if (data.desc) {
            const wordLimit = 50;
            const words = data.desc.split(' ');
            const needsTruncation = words.length > wordLimit;
            const shortDesc = needsTruncation ? words.slice(0, wordLimit).join(' ') + '...' : data.desc;
            
            contentHTML += `
                <div class="description description-collapsed" id="mobile-description">
                    ${shortDesc}
                </div>
                ${needsTruncation ? `
                    <button class="see-more-btn" onclick="window.toggleDescription('mobile')">
                        See more
                    </button>
                ` : ''}
            `;
            
            // Store full description for expansion
            window.mobileFullDescription = data.desc;
        }
        
        if (data.ages.length > 0 || data.weather) {
            contentHTML += '<div class="info-grid">';
            
            if (data.ages.length > 0) {
                contentHTML += `
                    <div class="info-section">
                        <h3>Suitable For</h3>
                        ${data.ages.map(age => `<div class="info-item">${age}</div>`).join('')}
                    </div>
                `;
            }
            
            if (data.weather || data.seasonalMonths) {
                contentHTML += `
                    <div class="info-section">
                        <h3>Good For</h3>
                        ${data.weather ? `<div class="info-item">${data.weather}</div>` : ''}
                        ${data.seasonalMonths ? `<div class="info-item">${data.seasonalMonths}</div>` : ''}
                    </div>
                 `;
             }
            
            contentHTML += '</div>';
        }
        
        content.innerHTML = contentHTML;
        
        console.log('Activating mobile sheet...');
        sheet.classList.add('active');
        backdrop.classList.add('active');
        console.log('Mobile sheet should now be visible');
        
    } else {
        const sidebarWidth = 440;
        const offsetX = -(sidebarWidth / 2);
        
        map.easeTo({
            center: coords,
            zoom: Math.max(map.getZoom(), 15),
            offset: [offsetX, 0],
            duration: 600
        });
        
        const sheet = document.getElementById('desktop-sheet');
        const content = document.getElementById('desktop-sheet-content');
        
        let contentHTML = `
            <h2>${data.name}</h2>
            <span class="category-badge">${data.category}</span>
        `;
        
        if (data.desc) {
            contentHTML += `<div class="description">${data.desc}</div>`;
        }
        
        if (data.ages.length > 0) {
            contentHTML += `
                <div class="info-section">
                    <h3>Suitable For</h3>
                    ${data.ages.map(age => `<div class="info-item">${age}</div>`).join('')}
                </div>
            `;
        }
        
        if (data.weather) {
            contentHTML += `
                <div class="info-section">
                    <h3>Good For</h3>
                    ${data.weather ? `<div class="info-item">${data.weather}</div>` : ''}
                    ${data.seasonalMonths ? `<div class="info-item">${data.seasonalMonths}</div>` : ''}                    
                </div>
            `;
        }
        
        if (data.website || data.googleMaps) {
            contentHTML += '<div class="links">';
            if (data.website) {
                const href = data.website.match(/^https?:\/\//i) ? data.website : `https://${data.website}`;
                contentHTML += `<a href="${href}" target="_blank" rel="noopener noreferrer">View Website</a>`;
            }
            if (data.googleMaps) {
                contentHTML += `<a href="${data.googleMaps}" target="_blank" rel="noopener noreferrer">Get Directions</a>`;
            }
            contentHTML += '</div>';
        }
        
        content.innerHTML = contentHTML;
        sheet.classList.add('active');
    }
};

// Toggle description expansion
window.toggleDescription = function(platform) {
    if (platform === 'mobile') {
        const desc = document.getElementById('mobile-description');
        const btn = event.target;
        
        if (desc.classList.contains('description-collapsed')) {
            desc.textContent = window.mobileFullDescription;
            desc.classList.remove('description-collapsed');
            desc.classList.add('description-expanded');
            btn.textContent = 'See less';
        } else {
            const words = window.mobileFullDescription.split(' ');
            desc.textContent = words.slice(0, 50).join(' ') + '...';
            desc.classList.remove('description-expanded');
            desc.classList.add('description-collapsed');
            btn.textContent = 'See more';
        }
    }
};

// FIXED: Close location sheet - now properly returns to list
window.closeLocationSheet = function() {
    const isMobile = window.innerWidth <= 600;
    
    if (isMobile) {
        const sheet = document.getElementById('mobile-sheet');
        const backdrop = document.getElementById('sheet-backdrop');
        sheet.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        const sheet = document.getElementById('desktop-sheet');
        sheet.classList.remove('active');
    }
    
    // Reset opacity on map icons - with error handling
    try {
        if (map.getLayer('Icons')) {
            map.setPaintProperty('Icons', 'icon-opacity', 1);
        }
    } catch (e) {
        console.warn('Error resetting Icons opacity:', e);
    }
    
    try {
        if (map.getLayer('Dots')) {
            map.setPaintProperty('Dots', 'icon-opacity', 1);
        }
    } catch (e) {
        console.warn('Error resetting Dots opacity:', e);
    }
    
    currentFeature = null;
    
    // Check if we should return to list - moved AFTER closing sheet
    if (sessionStorage.getItem('returnToList') === 'true') {
        sessionStorage.removeItem('returnToList');
        
        console.log('Returning to list view...');
        
        // Small delay to ensure sheet closes first
        setTimeout(() => {
            const listView = document.getElementById('list-view');
            const backdrop = document.getElementById('list-backdrop');
            listView.classList.add('active');
            backdrop.classList.add('active');
            
            console.log('List view reopened');
            
            // Restore scroll position
            const scrollPos = sessionStorage.getItem('listScrollPosition');
            if (scrollPos) {
                document.getElementById('list-items').scrollTop = parseInt(scrollPos);
                sessionStorage.removeItem('listScrollPosition');
                console.log('Scroll position restored:', scrollPos);
            }
        }, 100);
    }
};

// Multi-select filters
window.updateFilters = function() {
    const filtersByGroup = {};
    
    document.querySelectorAll('.drawer-content input[type="checkbox"]:checked').forEach(checkbox => {
        const filterType = checkbox.dataset.filter;
        if (!filtersByGroup[filterType]) {
            filtersByGroup[filterType] = [];
        }
        filtersByGroup[filterType].push(checkbox.value);
    });
    
    if (filtersByGroup.indoor_outdoor) {
        const weatherValues = filtersByGroup.indoor_outdoor;
        if (weatherValues.includes('Outdoor')) {
            if (!weatherValues.includes('Mixed')) {
                weatherValues.push('Mixed');
            }
        }
        if (weatherValues.includes('Indoor')) {
            if (!weatherValues.includes('Mixed')) {
                weatherValues.push('Mixed');
            }
        }
    }
    
    // Store current filters for list view
    currentFilters = filtersByGroup;
    
    const groupFilters = [];
    Object.keys(filtersByGroup).forEach(filterType => {
        if (filtersByGroup[filterType].length > 1) {
            groupFilters.push(['any', ...filtersByGroup[filterType].map(value => 
                ['==', ['get', filterType], value]
            )]);
        } else {
            groupFilters.push(['==', ['get', filterType], filtersByGroup[filterType][0]]);
        }
    });
    
    const filter = groupFilters.length ? ['all', ...groupFilters] : ['all'];
    map.setFilter('Dots', filter);
    map.setFilter('Icons', filter);
    
    // Update filter indicator in list view
    updateFilterIndicator();
    
    // Refresh list view if it's open
    if (document.getElementById('list-view').classList.contains('active')) {
        buildLocationsList();
    }
};

window.resetFilters = function() {
    document.querySelectorAll('.drawer-content input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
  
    document.querySelectorAll('.drawer-content label').forEach(label => {
        label.classList.remove('selected');
    });
    
    currentFilters = {};
    
    map.setFilter('Dots', ['all']);
    map.setFilter('Icons', ['all']);
    
    // Update filter indicator
    updateFilterIndicator();
    
    // Refresh list view if it's open
    if (document.getElementById('list-view').classList.contains('active')) {
        buildLocationsList();
    }
};

// Update the filter indicator badge in list view
function updateFilterIndicator() {
    const indicator = document.getElementById('list-filter-indicator');
    const countElement = document.getElementById('active-filter-count');
    
    if (!indicator || !countElement) return;
    
    // Count active filters
    const activeCount = document.querySelectorAll('.drawer-content input[type="checkbox"]:checked').length;
    
    if (activeCount > 0) {
        indicator.style.display = 'flex';
        countElement.textContent = activeCount;
    } else {
        indicator.style.display = 'none';
    }
}

// Toggle feedback modal
window.toggleFeedbackModal = function() {
    const modal = document.getElementById('feedback-modal');
    const backdrop = document.getElementById('feedback-backdrop');
    
    const isActive = modal.classList.contains('active');
    
    if (isActive) {
        modal.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        modal.classList.add('active');
        backdrop.classList.add('active');
    }
};

// Initialize
loadLocationsData();

map.on('load', () => {
    // GTM tracking
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        'event': 'map_initialized',
        'map_center': [4.9041, 52.3676] 
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Create hidden geolocation control (for functionality only)
    geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: true
    });
    
    map.addControl(geolocateControl, 'bottom-right');
    
    // Custom geolocation button
    const customGeoBtn = document.getElementById('custom-geolocate-btn');
    let isTracking = false;
    let geolocationAvailable = true;
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
        customGeoBtn.classList.add('disabled');
        customGeoBtn.setAttribute('aria-label', 'Geolocation not available');
        geolocationAvailable = false;
        console.log('Geolocation is not supported by this browser');
    }
    
    // Button click handler
    customGeoBtn.addEventListener('click', () => {
        if (!geolocationAvailable) {
            console.log('Geolocation not available');
            return;
        }
        
        if (customGeoBtn.classList.contains('disabled')) {
            console.log('Geolocation button is disabled');
            return;
        }
        
        // Always trigger - Mapbox control handles toggling internally
        // First click: starts tracking
        // Second click: stops tracking
        geolocateControl.trigger();
    });
    
    // Track geolocation events
    geolocateControl.on('trackuserlocationstart', () => {
        console.log('Tracking started');
        isTracking = true;
        customGeoBtn.classList.add('active');
        customGeoBtn.classList.remove('error');
    });
    
    geolocateControl.on('geolocate', (e) => {
        isTracking = true;
        customGeoBtn.classList.add('active');
        customGeoBtn.classList.remove('error');
        
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'user_location_found',
            'location_accuracy': e.coords.accuracy
        });
        
        // Refresh list if open to re-sort by distance
        if (document.getElementById('list-view').classList.contains('active')) {
            buildLocationsList();
        }
    });
    
    geolocateControl.on('trackuserlocationend', () => {
        console.log('Tracking ended');
        isTracking = false;
        customGeoBtn.classList.remove('active');
    });
    
    geolocateControl.on('error', (e) => {
        console.log('Geolocation error:', e.message, e.code);
        isTracking = false;
        customGeoBtn.classList.remove('active');
        
        // If permission denied (code 1) or unavailable (code 2), disable button
        if (e.code === 1 || e.code === 2) {
            customGeoBtn.classList.add('disabled');
            customGeoBtn.setAttribute('aria-label', 'Geolocation permission denied');
            geolocationAvailable = false;
            
            // Show error state briefly before going to disabled
            customGeoBtn.classList.add('error');
            setTimeout(() => {
                customGeoBtn.classList.remove('error');
            }, 2000);
        } else {
            // Temporary error - show error state
            customGeoBtn.classList.add('error');
            setTimeout(() => {
                customGeoBtn.classList.remove('error');
            }, 3000);
        }
        
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'user_location_error',
            'error_message': e.message,
            'error_code': e.code
        });
    });
    
    // Click handlers
    map.on('click', 'Icons', (e) => {
        if (!e.features?.length) return;
        window.openLocationSheet(e.features[0]);
    });
    
    map.on('click', 'Dots', (e) => {
        if (!e.features?.length) return;
        window.openLocationSheet(e.features[0]);
    });
    
    // Hover cursors (desktop only)
    if (!('ontouchstart' in window)) {
        map.on('mouseenter', 'Icons', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'Icons', () => map.getCanvas().style.cursor = '');
        
        map.on('mouseenter', 'Dots', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'Dots', () => map.getCanvas().style.cursor = '');
    }
    
    // Filter checkbox handlers
    document.querySelectorAll('.drawer-content input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            window.updateFilters();
            
            if (this.checked) {
                this.parentElement.classList.add('selected');
            } else {
                this.parentElement.classList.remove('selected');
            }
        });
    });
});
