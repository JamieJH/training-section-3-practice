(function () {
    const ACCESS_TOKEN = 'pk.eyJ1IjoiamFtaWUtbmF0bm9mZiIsImEiOiJja3E1NXg4NnExMGR0MnZtdmEzMTU4dXplIn0.Y9TQAtt3SlvttO8W4xQipA';
    const URL = 'https://api.mapbox.com'
    const locationInput = document.getElementById("location")
    const resultList = document.getElementById("search-results")
    const helpBtn = document.querySelector(".btn-help")
    const clearBtn = document.querySelector(".btn-clear")
    const directionsBtn = document.querySelector(".btn-directions")
    const clearRouteBtn = document.querySelector(".btn-clear-route")
    const clearInputBtn = document.querySelector(".btn-clear-input")
    const instructionsModal = document.querySelector(".instructions-modal")
    const statusBox = document.querySelector(".status-box")
    const mapContainer = document.getElementById("map")
    let map;
    let isDirectionEnabled = false;
    let searchResults = {}              // object to store at most 5 search results
    const markersInfo = []              // array to store markers as regular objects similar to a search result (except the original center)
    let markerPoints = {}               // array to store markers as map marker objs (except the original center)
    let directionsEndPoints = []        // store 2 points to show directions between them
    let isInstructionOpen = false       // true ì the instructions modal is visible (open)
    let markerClicked = false           // true if a marker is clicked
    let debounceId

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
        id: "original",
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

    const getUserPosition = (options) => {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options)
        })
    }

    getUserPosition()
        .then((position) => {       // user allow location
            setOriginalLocation(true, [position.coords.longitude, position.coords.latitude])
        })
        .catch(() => setOriginalLocation())

    function setOriginalLocation(isAvailable = false, coordinates = null) {
        if (isAvailable) {
            originalMarker.coordinates = coordinates
            originalMarker.name = "Your Location"
            originalMarker.address = ''
        }
        setupMap()
    }

    function populateResultList(isError = false) {
        resultList.innerHTML = ""
        if (isError || Object.keys(searchResults).length === 0) {
            const li = document.createElement("li")
            li.innerText = isError ? "Something went wrong. Please try again later!" : "No result found!"
            resultList.append(li)
            return
        }
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
            id: "location-" + feature.id.split(".")[1],
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
                populateResultList(isError = true)
            })
            .then(data => {
                searchResults = {}
                data.features.forEach(place => {
                    const id = place.id.split(".")[1]
                    searchResults[id] = featureToLocation(place)
                })
                populateResultList()
            })
            .catch(() => populateResultList(isError = true))
    }

    function removeRoute() {
        if (map.getLayer('route')) {
            map.removeLayer('route')
            map.removeSource('route')
            statusBox.classList.remove("show")
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

    function displayStatusBox(isError, duration, distance) {
        statusBox.classList.add("show")
        statusBox.innerHTML = (!isError) ?
            `<h3>Directions (Driving)</h3>
            <p>Distance: ${distance.km}km ${distance.meters}m</p>
            <p>Duration: ${duration.hours} hour(s) ${duration.minutes} minute(s)</p>` :
            `<h3>Error</h3>
            <p>Something went wrong. Please try again later!</p>`
    }

    function findDirections() {
        const coordinatesString = directionsEndPoints.map(point => point.coordinates.join(",")).join(";")
        fetch(`${URL}/directions/v5/mapbox/driving/${coordinatesString}?geometries=geojson&access_token=${ACCESS_TOKEN}`)
            .then(res => {
                if (res.status === 200 || res.ok) {
                    return res.json()
                }
                displayStatusBox(true, null, null)
            })
            .then(data => {
                const coordinates = data.routes[0].geometry.coordinates
                const duration = data.routes[0].duration    // time in seconds
                const distance = Math.floor(data.routes[0].distance)    // distance in meters

                const hours = Math.floor(duration / 3600)
                const minutes = Math.floor((duration % 3600) / 60)
                const km = Math.floor(distance / 1000)
                const meters = distance % 1000

                drawRoute(coordinates)
                displayStatusBox(false, { hours, minutes }, { km, meters })
            })
            .catch(() => displayStatusBox(true))
    }

    function addPointAndFindDirections(markerInfo) {
        if (directionsEndPoints.length === 2) {
            const firstMarker = directionsEndPoints.shift()   // remove the first item
            markerPoints[firstMarker.id].getElement().classList.remove("selected")
        }

        directionsEndPoints.push(markerInfo)
        const markerElement = document.querySelector(".marker#" + markerInfo.id)
        markerElement.classList.add("selected")
        if (directionsEndPoints.length === 2) {
            findDirections()
        }
    }

    function removeMarkerById(markerId) {
        markerPoints[markerId].remove()
        delete markerPoints[markerId]

        // remove route if the marker is part of a route
        const index = directionsEndPoints.findIndex(point => markerId === point.id)
        if (index !== -1) {
            removeRoute()
            directionsEndPoints.splice(index, 1)
        }
    }

    function removeAllMarkers() {
        Object.values(markerPoints).forEach(marker => marker.remove())
        markerPoints = {}
    }

    function addMarker(markerInfo) {
        markerClicked = false
        // if directions is disabled, user can only have one active marker at a time
        if (!isDirectionEnabled) {
            removeAllMarkers()
            removeRoute()
            directionsEndPoints.length = 0
        }
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
                <button class="btn-remove-marker" for=${markerInfo.id}>Remove marker</button>
            `))
            .addTo(map);

        if (isDirectionEnabled) {
            addPointAndFindDirections(markerInfo)
        }

        // on clicing a marker, if directionsEndPoints has 2 points, show a route between then
        markerPoint.getElement().addEventListener("click", () => {
            if (isDirectionEnabled) {
                // if marker is already in directionsEndPoints, remove it and remove the route
                const index = directionsEndPoints.findIndex(point => {
                    return markerInfo.coordinates[0] === point.coordinates[0] && markerInfo.coordinates[1] === point.coordinates[1]
                })

                if (index !== -1) {
                    document.getElementById(directionsEndPoints[index].id).classList.remove("selected")
                    directionsEndPoints.splice(index, 1)
                    removeRoute()
                }
                else {
                    addPointAndFindDirections(markerInfo)
                }
            }
            markerClicked = true
        })

        markersInfo.push(markerInfo)
        markerPoints[markerInfo.id] = markerPoint
    }

    // search for location once user has entered at least 3 letters
    locationInput.addEventListener("input", (e) => {
        clearTimeout(debounceId)
        resultList.classList.add("show")
        if (e.target.value.length >= 3) {
            debounceId = setTimeout(() => {
                locationSearch(e.target.value)
            }, 1000)
        }
    })

    // add a marker upon clicking a search result
    resultList.addEventListener("click", (e) => {
        if (e.target.tagName === 'LI') {
            const placeId = e.target.getAttribute("id")
            addMarker(searchResults[placeId])
            resultList.classList.remove("show")
            locationInput.value = e.target.innerText
        }
    })


    // clear all markers, directions and center back to the original center
    clearBtn.addEventListener("click", () => {
        markersInfo.length = 0
        removeAllMarkers()
        removeRoute()
        directionsEndPoints.length = 0
        addMarker(originalMarker)
    })

    // clear input
    clearInputBtn.addEventListener("click", () => {
        locationInput.value = ""
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
        directionsEndPoints.forEach(point => {
            document.getElementById(point.id).classList.remove("selected")
        })
        directionsEndPoints.length = 0
        removeRoute()
    })

    // remove marker when clicing on the remove marker button on the popup
    mapContainer.addEventListener("click", (e) => {
        if (e.target.className === "btn-remove-marker") {
            removeMarkerById(e.target.getAttribute("for"))
        }
    })

    // function to display or hide the instruction modal
    function toggleInstructions(isOn) {
        isInstructionOpen = isOn;
        isInstructionOpen ? instructionsModal.classList.add("show") : instructionsModal.classList.remove("show")
    }

    // the instruction modal will appear upon clicking the help button, click it again to close modal
    helpBtn.addEventListener("click", () => toggleInstructions(!isInstructionOpen))
    instructionsModal.querySelector(".btn-close-modal").addEventListener("click", () => toggleInstructions(false))
    instructionsModal.querySelector(".instructions-backdrop").addEventListener("click", () => toggleInstructions(false))

    function setupMap() {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: originalMarker.coordinates,
            zoom: 11,
        });

        // set the bounds of the map [[southwest coordinates], [northeast coordinates]]
        var bounds = [[BBOX.minX - 0.1, BBOX.minY - 0.1], [BBOX.maxX + 0.1, BBOX.maxY + 0.1]];
        map.setMaxBounds(bounds);

        // add marker for original center
        addMarker(originalMarker)

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
                        displayStatusBox(true, null, null)
                    })
                    .then(data => {
                        const featureCoors = data.features[0].geometry.coordinates
                        let location = {
                            id: "location-" + Math.random().toString().split(".")[1],
                            name: 'Clicked Location',
                            coordinates: clickedCoors,
                            address: { full: 'NO_NEAREST_ADDRESS' }
                        }

                        // only take the nearest feature's coordinates when it is not too far
                        // else take the on click coordinates (meaning there's no other info like address or name)
                        if (Math.abs(clickedCoors[0] - featureCoors[0]) <= 0.03 && Math.abs(clickedCoors[1] - featureCoors[1]) <= 0.03) {
                            location = featureToLocation(data.features[0])
                        }
                        statusBox.classList.remove("show")

                        addMarker(location)
                    })
                    .catch(() => displayStatusBox(true, null, null))
            }
            markerClicked = false
        })
    }

})()