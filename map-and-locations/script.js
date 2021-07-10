(function () {
    const ACCESS_TOKEN = 'pk.eyJ1IjoiamFtaWUtbmF0bm9mZiIsImEiOiJja3E1NXg4NnExMGR0MnZtdmEzMTU4dXplIn0.Y9TQAtt3SlvttO8W4xQipA';
    const URL = 'https://api.mapbox.com'
    const locationInput = document.getElementById("location")
    const resultList = document.getElementById("search-results")
    const helpBtn = document.querySelector(".btn-help")
    const clearBtn = document.querySelector(".btn-clear")
    const directionsBtn = document.querySelector(".btn-directions")
    const clearRouteBtn = document.querySelector(".btn-clear-route")

    const instructionsModal = document.querySelector(".instructions-modal")
    const modalBackdrop = instructionsModal.querySelector(".instructions-backdrop")
    const directionsInfoCard = document.querySelector(".directions-info")
    const mapContainer = document.getElementById("map")
    const locationTypes = ['locality', 'place', 'region', 'country', 'postcode']
    let map;
    let isDirectionEnabled = false;
    let searchResults = {}          // object to store at most 5 search results
    let markersInfo = []            // array to store markers as regular objects similar to a search result (except the original center)
    let markerPoints = []           // array to store markers as map marker objs (except the original center)
    let directionsEndPoints = []    // store 2 points to show directions between them
    let isInstructionOpen = false   // true ì the instructions modal is visible (open)
    let markerClicked = false       // true if a marker is clicked

    // coordinates to create a bounding box to limit search zone, the box corners are:
    // top left: (minX, maxY); top right: (max, max); bottom left: (min, min), bottom right: (maxX, miY)
    const BBOX = {
        minX: 106.3586559,
        minY: 10.256969,
        maxX: 107.1788833,
        maxY: 11.159164
    }

    // default marker if user refuse to allow location
    let originalMarker = {
        name: "Journey Horizon",
        coordinates: [106.6781463, 10.7643486],
        address: {
            full: '2 Trần Phú, Phường 4, Quận 5, Thành phố Hồ Chí Minh, Vietnam',
            locality: 'Phường 4',
            place: 'Quận 5',
            region: 'Ho Chi Minh City',
            country: 'Vietnam',
            postcode: '700000'
        },
    }


    mapboxgl.accessToken = ACCESS_TOKEN

    // get current location
    navigator.geolocation.getCurrentPosition(successLocation, errorLocation, { enableHighAccuracy: true })

    function successLocation(location) {
        originalMarker.coordinates = [location.coords.longitude, location.coords.latitude]
        originalMarker.name = "Your Location"
        originalMarker.address = ''
        setupMap([location.coords.longitude, location.coords.latitude])
    }

    function errorLocation() {
        setupMap(originalCenter)
    }

    function populateResultList() {
        resultList.innerHTML = ""
        for (const placeId in searchResults) {
            const li = document.createElement("li")
            li.setAttribute("id", placeId)
            li.innerText = searchResults[placeId].name
            resultList.append(li)
        }
    }

    // function to transform a 'feature' received from api call to an obj with required values
    function featureToLocation(feature) {
        const subLocations = feature.context
        const address = { full: feature.properties.address }

        // some feature' address alone is not enough information
        subLocations.forEach(loc => {
            const type = loc.id.split('.')[0]   // locality, place(ward), region(city), country, postcode
            address[type] = loc.text
        })

        return {
            id: feature.id,
            name: feature.text,
            coordinates: feature.center,
            address: address
        }
    }

    function locationSearch(input) {
        fetch(`${URL}/geocoding/v5/mapbox.places/${input}.json?bbox=${BBOX.minX},${BBOX.minY},${BBOX.maxX},${BBOX.maxY}&access_token=${ACCESS_TOKEN}`)
            .then(res => {
                if (res.status === 200 || res.ok) {
                    return res.json()
                }
                else {
                    console.log("Fetch error");
                }
            })
            .then(data => {
                searchResults = {}
                const places = data.features
                places.forEach(place => {
                    searchResults[place.id] = featureToLocation(place)
                })
                populateResultList()
            })
            .catch(err => console.log(err))
    }

    function removeRoute() {
        if (map.getLayer('route')) {
            map.removeLayer('route')
            map.removeSource('route')
        }
    }

    function drawRoute(coordinates) {
        // if there's already a route, remove it
        if (map.getSource('route')) {
            removeRoute()
        }
        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': coordinates
                }
            }
        });
        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#1fb9ad',
                'line-width': 8
            }
        });

    }

    function findDirections() {
        const coordinatesString = directionsEndPoints.map(coors => coors.join(",")).join(";")
        fetch(`${URL}/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&access_token=${ACCESS_TOKEN}`)
            .then(res => {
                if (res.status === 200 || res.ok) {
                    return res.json()
                }
                else {
                    console.log("Fetch error");
                }
            })
            .then(data => {
                const coordinates = data.routes[0].geometry.coordinates
                const duration = data.routes[0].duration    // time in seconds
                const distance = Math.floor(data.routes[0].distance)    // distance in meters

                // get time in format: N hours M minutes
                const hours = Math.floor(duration / 3600)
                const minutes = Math.floor((duration % 3600) / 60)

                // get distance in format: X km Y m
                const km = Math.floor(distance / 1000)
                const meters = distance % 1000

                drawRoute(coordinates)
                directionsInfoCard.classList.add("show")
                directionsInfoCard.querySelector("#duration").innerHTML = `Duration: ${hours} hour(s) ${minutes} minute(s)`
                directionsInfoCard.querySelector("#distance").innerHTML = `Distance: ${km}km ${meters}m`

            })
            .catch(err => console.log(err))
    }

    function addMarker(markerInfo, isOriginal = false) {
        markerClicked = false
        const address = markerInfo.address
        const marker = {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: markerInfo.coordinates
            },
            properties: {
                title: markerInfo.name,
                address: address.full,
                location: `
                ${address.locality || "NO_LOCALITY"}, ${address.place || "NO_WARD"}, 
                ${address.region || "NO_CITY"}, ${address.country || "NO_COUNTRY"}, 
                ${address.postcode || "NO_POSTCODE"}`,
            }
        }

        // center on the selected marker
        map.flyTo({
            center: markerInfo.coordinates
        })

        // add new marker to map
        let markerElement = document.createElement('div');
        markerElement.className = 'marker';
        markerElement.id = markerInfo.id

        const markerPoint = new mapboxgl.Marker(markerElement)
            .setLngLat(marker.geometry.coordinates)
            .setPopup(new mapboxgl.Popup({ offset: 25 }) // an overhead card upon clicking the marker
                .setHTML(`
                <h3>${marker.properties.title}</h3>
                ${(marker.properties.address) ? `<p>Full Address: ${marker.properties.address}</p>` : ''}
                <p>Location: ${marker.properties.location}</p>
                <p>Latitude: ${marker.geometry.coordinates[1]};</p> 
                <p>Longitude: ${marker.geometry.coordinates[0]};</p>
            `))
            .addTo(map);

        // on clicing a marker, if directionsEndPoints has 2 points, show a route between then
        markerPoint.getElement().addEventListener("click", () => {
            if (isDirectionEnabled) {
                // if marker is already in directionsEndPoints, remove it and remove the route
                const index = directionsEndPoints.findIndex(coordinates => {
                    return markerInfo.coordinates[0] === coordinates[0] && markerInfo.coordinates[1] === coordinates[1]
                })

                if (index !== -1) {
                    directionsEndPoints.splice(index, 1)
                    removeRoute()
                }
                else {
                    if (directionsEndPoints.length === 2) {
                        directionsEndPoints.shift()   // remove the first item
                    }
                    directionsEndPoints.push(markerInfo.coordinates)
                    if (directionsEndPoints.length === 2) {
                        findDirections()
                    }
                }
            }
            markerClicked = true
        })

        if (!isOriginal) {
            markersInfo.push(markerInfo)
            markerPoints.push(markerPoint)
        }

    }

    // search for location once user has entered at least 5 letters
    locationInput.addEventListener("input", (e) => {
        resultList.classList.add("show")
        if (e.target.value.length >= 5) {
            locationSearch(e.target.value)
        }
    })

    // add a marker upon clicking a search result
    resultList.addEventListener("click", (e) => {
        if (e.target.tagName === 'LI') {
            const placeId = e.target.getAttribute("id")
            addMarker(searchResults[placeId])
            resultList.classList.remove("show")
        }
    })

    // clear all markers, directions and center back to the original center
    clearBtn.addEventListener("click", () => {
        // center on to the original center
        map.flyTo({
            center: originalMarker.coordinates
        })

        // remove all markers (except for the original)
        markersInfo.length = 0
        markerPoints.forEach(point => point.remove())
        removeRoute()
        directionsEndPoints.length = 0
        directionsInfoCard.classList.remove("show")
    })

    // toggle direction button to start looking for a route between 2 points
    directionsBtn.addEventListener("click", () => {
        isDirectionEnabled = !isDirectionEnabled
        if (isDirectionEnabled) {
            directionsBtn.classList.add("on")
            directionsBtn.innerHTML = "Disable Directions"
        }
        else {
            directionsBtn.classList.remove("on")
            directionsBtn.innerHTML = "Enabled Directions"
        }
    })

    // clear all routes button, also clear the directionsEndPoints array
    clearRouteBtn.addEventListener("click", () => {
        directionsEndPoints.length = 0
        removeRoute()
    })

    // function to display or hide the instruction modal
    function toggleInstructions(isOn) {
        isInstructionOpen = isOn
        if (isInstructionOpen) {
            instructionsModal.classList.add("show")
        }
        else {
            instructionsModal.classList.remove("show")
        }
    }


    // the instruction modal will appear upon clicking the help button, click it again to close modal
    helpBtn.addEventListener("click", () => toggleInstructions(!isInstructionOpen))
    instructionsModal.querySelector(".btn-close-modal").addEventListener("click", () => toggleInstructions(false))
    instructionsModal.querySelector(".instructions-backdrop").addEventListener("click", () => toggleInstructions(false))

    function setupMap(center) {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: center,
            zoom: 11,
        });

        // set the bounds of the map [[southwest coordinates], [northeast coordinates]]
        var bounds = [[BBOX.minX - 0.1, BBOX.minY - 0.1], [BBOX.maxX + 0.1, BBOX.maxY + 0.1]];
        map.setMaxBounds(bounds);

        // add marker for original center
        addMarker(originalMarker, true)

        // Add zoom and rotation controls to the map.
        const navigationControl = new mapboxgl.NavigationControl()
        map.addControl(navigationControl);

        map.on('click', (e) => {
            // when a user click is not on a marker, create a marker of that point
            if (!markerClicked) {
                const clickedCoors = [e.lngLat.lng, e.lngLat.lat]
                // retrieve the closest address point relative to these coordintates
                fetch(`${URL}/geocoding/v5/mapbox.places/${encodeURIComponent(clickedCoors.join(','))}.json?&access_token=${ACCESS_TOKEN}`)
                    .then(res => {
                        if (res.status === 200 || res.ok) {
                            return res.json()
                        }
                        else {
                            console.log("Fetch Error: Unable to get location from coordinates");
                        }
                    })
                    .then(data => {
                        const featureCoors = data.features[0].geometry.coordinates
                        let location = {
                            id: Math.random().toString(),
                            name: 'Clicked Location',
                            coordinates: clickedCoors,
                            address: { full: 'NO_NEAREST_ADDRESS' }
                        }

                        // only take the nearest feature's coordinates when it is not too far
                        // else take the on click coordinates (meaning there's no other info like address or name)
                        if (Math.abs(clickedCoors[0] - featureCoors[0]) <= 0.03 && Math.abs(clickedCoors[1] - featureCoors[1]) <= 0.03) {
                            location = featureToLocation(data.features[0])
                        }

                        addMarker(location)

                    })
            }
            markerClicked = false
        })
    }

})()