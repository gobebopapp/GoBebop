mapboxgl.accessToken = 'pk.eyJ1IjoiYW1hY2JldGgxIiwiYSI6ImNtZzB0MGd0ZjBqMDEybHIzbnU0dzFuam4ifQ.aGD0Ws8Zut0q4f1iTYUBeA';

// Check WebGL support
if (!mapboxgl.supported()) {
    alert('Your browser does not support Mapbox GL. Please try using Safari or updating Chrome.');
    console.error('WebGL not supported');
}

// Add error handling for map initialization
let map;
try {
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/amacbeth1/cmk44u6xk00ka01s90foffz39',
        center: [4.9041, 52.3676],
        zoom: 12,
        // iOS compatibility settings
        preserveDrawingBuffer: true,
        refreshExpiredTiles: false
    });
    
    // Log successful map creation
    console.log('Map initialized successfully');
} catch (error) {
    console.error('Failed to initialize map:', error);
    // Show error to user
    document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Failed to load map. Please refresh the page.</div>';
}

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
    const iconUrl = feature.properties.icon_url || '';
    
    const ages = [];
    if (feature.properties.age_small === 'TRUE') ages.push('👶 Babies');
    if (feature.properties.age_medium === 'TRUE') ages.push('👦 Toddlers');
    if (feature.properties.age_large === 'TRUE') ages.push('👧 Big Kids');
    
    const weatherMap = {
        'Indoor': '☔ Indoor',
        'Outdoor': '☀️ Outdoor', 
        'Mixed': '☀️☔ Mixed Indoor/Outdoor'
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
                <div class="list-item-title">
                    ${iconUrl ? `<img src="${iconUrl}" alt="" class="location-icon" loading="lazy">` : ''}
                    <h4>${name}</h4>
                </div>
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
    
    // Try to get icon_url from feature properties first
    let iconUrl = f.properties.icon_url || '';
    
    // If icon_url is missing, try to find it in our local locationsData
    if (!iconUrl && locationsData) {
        const matchingFeature = locationsData.features.find(feature => {
            const featureName = feature.properties.name_en || feature.properties.Name;
            return featureName === name;
        });
        
        if (matchingFeature) {
            iconUrl = matchingFeature.properties.icon_url || '';
            console.log('Found icon_url from local data:', iconUrl);
        }
    }
    
    console.log('buildSheetContent - Feature properties:', f.properties);
    console.log('buildSheetContent - Final iconUrl:', iconUrl);
    
    const ages = [];
    if (f.properties.age_small === 'TRUE') ages.push('👶 Babies (0-2)');
    if (f.properties.age_medium === 'TRUE') ages.push('👦 Toddlers (3-6)');
    if (f.properties.age_large === 'TRUE') ages.push('👧 Big Kids (7-12)');
    
    const weatherMap = {
        'Indoor': '☔ Indoor',
        'Outdoor': '☀️ Outdoor', 
        'Mixed': '☀️☔ Mixed Indoor/Outdoor'
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
        iconUrl,
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
        
        console.log('Building mobile sheet content...');
        console.log('Data object:', data);
        console.log('Icon URL from data:', data.iconUrl);
        
        // Set title in header with icon
        if (data.iconUrl) {
            console.log('Setting title WITH icon');
            title.innerHTML = `<img src="${data.iconUrl}" alt="" class="location-icon-mobile" loading="lazy"> ${data.name}`;
            console.log('Title innerHTML:', title.innerHTML);
        } else {
            console.log('Setting title WITHOUT icon (iconUrl is empty)');
            title.textContent = data.name;
        }
        
        // Build content - category badge first, description, then simple text links
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
        
        // Add simple text links with icons below description
        if (data.website || data.googleMaps) {
            contentHTML += '<div class="location-links">';
            if (data.website) {
                const href = data.website.match(/^https?:\/\//i) ? data.website : `https://${data.website}`;
                contentHTML += `
                    <a href="${href}" target="_blank" rel="noopener noreferrer" class="location-link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                        </svg>
                        <span>View Website</span>
                    </a>
                `;
            }
            if (data.googleMaps) {
                contentHTML += `
                    <a href="${data.googleMaps}" target="_blank" rel="noopener noreferrer" class="location-link">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        <span>Get Directions</span>
                    </a>
                `;
            }
            contentHTML += '</div>';
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
                        <h3>Facilities</h3>
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
        
        console.log('Building desktop sheet...');
        console.log('Data object:', data);
        console.log('Icon URL from data:', data.iconUrl);
        
        let contentHTML = `
            <h2>
                ${data.iconUrl ? `<img src="${data.iconUrl}" alt="" class="location-icon-desktop" loading="lazy">` : ''}
                ${data.name}
            </h2>
            <span class="category-badge">${data.category}</span>
        `;
        
        console.log('Desktop sheet HTML includes icon?', data.iconUrl ? 'YES' : 'NO');
        
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

// Share location function - uses native share API when available
window.shareLocation = function() {
    if (!currentFeature) return;
    
    const name = currentFeature.properties.name_en || currentFeature.properties.Name || 'Location';
    const shareUrl = `${window.location.origin}${window.location.pathname}?location=${encodeURIComponent(name)}`;
    const shareData = {
        title: `${name} - GoBebop`,
        text: `Check out ${name} on GoBebop!`,
        url: shareUrl
    };
    
    // Try native share API first (mobile devices)
    if (navigator.share) {
        navigator.share(shareData)
            .catch((error) => {
                // User cancelled or error - that's okay, do nothing
                console.log('Share cancelled or failed:', error);
            });
    } else {
        // Fallback to clipboard for desktop
        navigator.clipboard.writeText(shareUrl).then(() => {
            // Show a temporary success message
            const btn = event.target.closest('button');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
            btn.style.background = 'rgba(77, 170, 187, 0.2)';
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
            }, 2000);
        }).catch((error) => {
            console.error('Failed to copy to clipboard:', error);
            alert('Failed to copy link. Please try again.');
        });
    }
};

// Check URL for shared location on load
function checkSharedLocation() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedLocationName = urlParams.get('location');
    
    if (!sharedLocationName) return;
    
    // Wait for data to load if not ready yet
    if (!locationsData) {
        console.log('Waiting for location data to load...');
        setTimeout(checkSharedLocation, 200);
        return;
    }
    
    // Wait for map to be fully loaded and idle (important for iOS)
    if (!map.loaded() || !map.isStyleLoaded()) {
        console.log('Waiting for map to be ready...');
        setTimeout(checkSharedLocation, 200);
        return;
    }
    
    console.log('Looking for shared location:', sharedLocationName);
    
    // Find the feature by name
    const feature = locationsData.features.find(f => {
        const featureName = f.properties.name_en || f.properties.Name;
        return featureName === decodeURIComponent(sharedLocationName);
    });
    
    if (feature) {
        console.log('Found shared location, opening:', feature);
        const coords = feature.geometry.coordinates;
        
        // Fly to location
        map.flyTo({
            center: coords,
            zoom: 15,
            duration: 1500
        });
        
        // Open the location sheet after flying
        setTimeout(() => {
            window.openLocationSheet(feature);
        }, 1000);
    } else {
        console.warn('Shared location not found:', sharedLocationName);
    }
}

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

// Add error handler for map
if (map) {
    map.on('error', (e) => {
        console.error('Map error:', e);
    });

    map.on('load', () => {
        console.log('Map load event triggered');
        
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
    let hasBeenClicked = false;
    let permissionState = 'prompt'; // 'prompt', 'granted', 'denied'
    
    // Stop pulse animation after 10 seconds
    setTimeout(() => {
        customGeoBtn.classList.add('pulse-stopped');
    }, 10000);
    
    // Check if geolocation is available
    if (!navigator.geolocation) {
        customGeoBtn.classList.add('disabled');
        customGeoBtn.setAttribute('aria-label', 'Geolocation not available');
        geolocationAvailable = false;
        permissionState = 'denied';
        console.log('Geolocation is not supported by this browser');
    } else {
        // Check permission state on load (if browser supports it)
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                permissionState = result.state;
                if (result.state === 'denied') {
                    customGeoBtn.classList.add('disabled');
                    customGeoBtn.setAttribute('aria-label', 'Geolocation permission denied');
                    geolocationAvailable = false;
                }
                // Listen for permission changes
                result.addEventListener('change', () => {
                    permissionState = result.state;
                    if (result.state === 'denied') {
                        customGeoBtn.classList.add('disabled');
                        customGeoBtn.classList.remove('active');
                        customGeoBtn.setAttribute('aria-label', 'Geolocation permission denied');
                        geolocationAvailable = false;
                        isTracking = false;
                    } else if (result.state === 'granted') {
                        customGeoBtn.classList.remove('disabled');
                        customGeoBtn.setAttribute('aria-label', 'Find my location');
                        geolocationAvailable = true;
                    }
                });
            }).catch((err) => {
                // Permissions API not supported (e.g., iOS Safari)
                console.log('Permissions API not supported:', err);
            });
        }
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
        
        // Stop pulse permanently once clicked
        if (!hasBeenClicked) {
            hasBeenClicked = true;
            customGeoBtn.classList.add('pulse-stopped');
        }
        
        // Always trigger - Mapbox control handles toggling internally
        // First click: starts tracking
        // Second click: stops tracking
        geolocateControl.trigger();
    });
    
    // Track geolocation events
    // Note: trackuserlocationstart fires before permission is granted
    // We only set active state on successful geolocate
    geolocateControl.on('trackuserlocationstart', () => {
        console.log('Tracking started (waiting for permission...)');
        // Don't set active state yet - wait for permission and location
    });
    
    geolocateControl.on('geolocate', (e) => {
        console.log('Location found');
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
        
        // Error codes:
        // 1 = PERMISSION_DENIED
        // 2 = POSITION_UNAVAILABLE
        // 3 = TIMEOUT
        
        if (e.code === 1) {
            // Permission explicitly denied - disable permanently
            customGeoBtn.classList.add('disabled');
            customGeoBtn.setAttribute('aria-label', 'Geolocation permission denied');
            geolocationAvailable = false;
            permissionState = 'denied';
            
            // Show error state briefly before going to disabled
            customGeoBtn.classList.add('error');
            setTimeout(() => {
                customGeoBtn.classList.remove('error');
            }, 2000);
        } else if (e.code === 2) {
            // Position unavailable - might be temporary
            customGeoBtn.classList.add('error');
            setTimeout(() => {
                customGeoBtn.classList.remove('error');
            }, 3000);
        } else {
            // Timeout or other temporary error
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
    
    // Check for shared location after map is loaded
    // Longer delay for iOS compatibility
    setTimeout(() => {
        checkSharedLocation();
    }, 1000);
    });
} else {
    console.error('Map object not created, skipping event handlers');
}
