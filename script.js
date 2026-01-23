mapboxgl.accessToken = 'pk.eyJ1IjoiYW1hY2JldGgxIiwiYSI6ImNtZzB0MGd0ZjBqMDEybHIzbnU0dzFuam4ifQ.aGD0Ws8Zut0q4f1iTYUBeA';
let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/amacbeth1/cmk44u6xk00ka01s90foffz39',
    center: [4.9041, 52.3676],
    zoom: 12
});

let currentFeature = null;
let geolocateControl = null;

// Toggle filter drawer
window.toggleFilterDrawer = function() {
    const drawer = document.getElementById('filter-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    
    const isActive = drawer.classList.contains('active');
    
    if (isActive) {
        drawer.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        drawer.classList.add('active');
        backdrop.classList.add('active');
    }
};

// Highlight selected location
function highlightSelectedLocation(layerId, featureId) {
    map.setPaintProperty(layerId, 'icon-opacity', [
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
    currentFeature = feature;
    const data = buildSheetContent(feature);
    const coords = feature.geometry.coordinates;
    
    const featureId = feature.properties.id || feature.properties.name_en || feature.properties.Name;
    const layerId = feature.layer?.id || 'Icons';
    
    highlightSelectedLocation(layerId, featureId);
    
    const isMobile = window.innerWidth <= 600;
    
    if (isMobile) {
        const totalHeight = window.innerHeight;
        const headerHeight = 50;
        const sheetHeight = totalHeight * 0.5;
        const offsetY = -(sheetHeight / 2);
        
        // Center without aggressive zoom - stay at current zoom or gently zoom to 14
        const targetZoom = Math.min(Math.max(map.getZoom(), 13), 14);
        
        map.easeTo({
            center: coords,
            zoom: targetZoom,
            offset: [0, offsetY],
            duration: 600
        });
    } else {
        const sidebarWidth = 440;
        const offsetX = -(sidebarWidth / 2);
        
        map.easeTo({
            center: coords,
            zoom: Math.max(map.getZoom(), 15),
            offset: [offsetX, 0],
            duration: 600
        });
    }
    
    if (isMobile) {
        const sheet = document.getElementById('mobile-sheet');
        const backdrop = document.getElementById('sheet-backdrop');
        const content = document.getElementById('mobile-sheet-content');
        
        let contentHTML = `
            <h2>${data.name}</h2>
            <span class="category-badge">${data.category}</span>
        `;
        
        if (data.desc) {
            contentHTML += `<div class="description">${data.desc}</div>`;
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
        
        if (data.website || data.googleMaps) {
            contentHTML += '<div class="links">';
            if (data.website) {
                const displayText = data.website.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                const href = data.website.match(/^https?:\/\//i) ? data.website : `https://${data.website}`;
                contentHTML += `<a href="${href}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
            }
            if (data.googleMaps) {
                contentHTML += `<a href="${data.googleMaps}" target="_blank" rel="noopener noreferrer">View on Google Maps</a>`;
            }
            contentHTML += '</div>';
        }
        
        content.innerHTML = contentHTML;
        sheet.classList.add('active');
        backdrop.classList.add('active');
        
    } else {
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
                const displayText = data.website.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                const href = data.website.match(/^https?:\/\//i) ? data.website : `https://${data.website}`;
                contentHTML += `<a href="${href}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
            }
            if (data.googleMaps) {
                contentHTML += `<a href="${data.googleMaps}" target="_blank" rel="noopener noreferrer">View on Google Maps</a>`;
            }
            contentHTML += '</div>';
        }
        
        content.innerHTML = contentHTML;
        sheet.classList.add('active');
    }
};

// Close location sheet
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
    
    if (map.getLayer('Icons')) {
        map.setPaintProperty('Icons', 'icon-opacity', 1);
    }
    if (map.getLayer('Dots')) {
        map.setPaintProperty('Dots', 'icon-opacity', 1);
    }
    
    currentFeature = null;
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
};

window.resetFilters = function() {
    document.querySelectorAll('.drawer-content input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
  
    document.querySelectorAll('.drawer-content label').forEach(label => {
        label.classList.remove('selected');
    });
    
    map.setFilter('Dots', ['all']);
    map.setFilter('Icons', ['all']);
};

map.on('load', () => {
    // GTM tracking
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        'event': 'map_initialized',
        'map_center': [4.9041, 52.3676] 
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocation control
    geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true,
        showAccuracyCircle: true
    });
    
    map.addControl(geolocateControl, 'bottom-right');
    
    // Track geolocation events for analytics
    geolocateControl.on('geolocate', (e) => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'user_location_found',
            'location_accuracy': e.coords.accuracy
        });
    });
    
    geolocateControl.on('error', (e) => {
        console.log('Geolocation error:', e.message);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'user_location_error',
            'error_message': e.message
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
