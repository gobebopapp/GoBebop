mapboxgl.accessToken = 'pk.eyJ1IjoiYW1hY2JldGgxIiwiYSI6ImNtZzB0MGd0ZjBqMDEybHIzbnU0dzFuam4ifQ.aGD0Ws8Zut0q4f1iTYUBeA';
let map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/amacbeth1/cmk44u6xk00ka01s90foffz39',
    center: [4.9041, 52.3676],
    zoom: 12
});

// Unified function to build popup HTML for both Dots and Icons
function buildPopupHTML(f) {
    const name = f.properties.name_en || f.properties.Name || 'No Name';
    const category = f.properties.secondary_category || f.properties.primary_category || f.properties.category || 'N/A';
    const desc = f.properties.description ? `<p>${f.properties.description}</p>` : '';
     
    // Age suitability
    let ageHTML = '<p><strong>Suitable for:</strong><br>';
    if (f.properties.age_small === 'TRUE') ageHTML += '👶 Babies (0-2)<br>';
    if (f.properties.age_medium === 'TRUE') ageHTML += '👦 Toddlers (3-6)<br>';
    if (f.properties.age_large === 'TRUE') ageHTML += '👧 Big Kids (7-12)';
    ageHTML += '</p>';
    
    // Weather suitability
    const weatherMap = {
        'Indoor': '☔ Rainy Days',
        'Outdoor': '☀️ Sunny Days', 
        'Mixed': '☀️☔ Any Weather'
    };
    const weather = f.properties.indoor_outdoor ? weatherMap[f.properties.indoor_outdoor] || weatherMap.Mixed : '';
    const weatherHTML = weather ? `<p><strong>Good for:</strong><br>${weather}</p>` : '';
    
    // Links section (NEW IMPLEMENTATION)
    let linksHTML = '';
    const website = f.properties.website?.trim();
    const googleMaps = f.properties.google_maps?.trim();
    
    if (website || googleMaps) {
        linksHTML = '<p><strong>More info:</strong><br>';
        
        if (website) {
            const displayText = website.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
            const href = website.match(/^https?:\/\//i) ? website : `https://${website}`;
            linksHTML += `<a href="${href}" target="_blank" rel="noopener noreferrer">${displayText}</a><br>`;
        }
        
        if (googleMaps) {
            linksHTML += `<a href="${googleMaps}" target="_blank" rel="noopener noreferrer">Google Maps</a></p>`;
        }
    }
    
    return `
        <div class="popup-content">
            <h3>${name}</h3>
            ${desc}
            <p><strong>Category:</strong> ${category}</p>
            ${ageHTML}
            ${weatherHTML}
            ${linksHTML}
        </div>
    `;
}

// Multi-select filters (OR within sections, AND between sections)
window.updateFilters = function() {
    const filtersByGroup = {};
    
    document.querySelectorAll('#filters input[type="checkbox"]:checked').forEach(checkbox => {
        const filterType = checkbox.dataset.filter;
        if (!filtersByGroup[filterType]) {
            filtersByGroup[filterType] = [];
        }
        filtersByGroup[filterType].push(checkbox.value);
    });
    
    // Handle special case for weather: Sunny/Rainy auto-include Mixed
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
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
  
  document.querySelectorAll('#filters label').forEach(label => {
        label.classList.remove('selected');
    });
    
    map.setFilter('Dots', ['all']);
    map.setFilter('Icons', ['all']);
};

map.on('load', () => {
    // --- SCALABLE TRACKING START ---
    // Pushes event to GTM when the map is actually ready for interaction
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
        'event': 'map_initialized',
        'map_center': [4.9041, 52.3676] 
    });
    // --- SCALABLE TRACKING END ---

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Toggle filter panel
    document.getElementById('toggle-filters').addEventListener('click', function() {
        const filters = document.getElementById('filters');
        filters.classList.toggle('collapsed');
        this.textContent = filters.classList.contains('collapsed') ? '☰' : '✕';
    });
    
    // Icons popups + hover (uses unified function)
    map.on('click', 'Icons', (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const coords = f.geometry.coordinates.slice();
        new mapboxgl.Popup({ offset: 15 }).setLngLat(coords).setHTML(buildPopupHTML(f)).addTo(map);
    });
    
    if (!('ontouchstart' in window)) {
        map.on('mouseenter', 'Icons', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'Icons', () => map.getCanvas().style.cursor = '');
        
        map.on('mouseenter', 'Dots', () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', 'Dots', () => map.getCanvas().style.cursor = '');
    }
    
    
    // Dots popups + hover (uses unified function)  
    map.on('click', 'Dots', (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];
        const coords = f.geometry.coordinates.slice();
        new mapboxgl.Popup({ offset: 15 }).setLngLat(coords).setHTML(buildPopupHTML(f)).addTo(map);
    });
    
    
    
    // *** ADD THIS NEW BLOCK - REPLACES your existing checkbox listeners ***
    document.querySelectorAll('#filters input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            window.updateFilters(); // Your existing filter logic
            
            // NEW: Visual feedback - label turns red with checkmark
            if (this.checked) {
                this.parentElement.classList.add('selected');
            } else {
                this.parentElement.classList.remove('selected');
            }
        });
    });
    // *** END NEW BLOCK ***
});

// Typeform feedback button (icon only + custom tooltip)
const typeformBtn = document.createElement('button');
typeformBtn.innerHTML = '💡';
typeformBtn.setAttribute('aria-label', 'Submit feedback');

// Create custom tooltip
const tooltip = document.createElement('div');
tooltip.innerHTML = 'Submit feedback';
tooltip.style.cssText = `
  position: absolute;
  bottom: 55px;
  right: 0;
  background: #333;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: system-ui;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1001;
`;

// Button styles
typeformBtn.style.cssText = `
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: #ffffff;
  color: #ffffff;
  cursor: pointer;
  font-size: 30px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  padding: 0;
`;

// Hover effects
typeformBtn.onmouseover = () => {
  typeformBtn.style.boxShadow = '0 3px 12px rgba(0,0,0,0.25)';
  tooltip.style.opacity = '1';
};
typeformBtn.onmouseout = () => {
  typeformBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  tooltip.style.opacity = '0';
};

// Click opens your Typeform
typeformBtn.onclick = () => window.open('https://form.typeform.com/to/F3p185qi', '_blank', 'noopener,noreferrer');

// Add tooltip to button wrapper and attach to body
const wrapper = document.createElement('div');
wrapper.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999; display: flex; flex-direction: column-reverse; gap: 4px;';
wrapper.appendChild(tooltip);
wrapper.appendChild(typeformBtn);
document.body.appendChild(wrapper);
