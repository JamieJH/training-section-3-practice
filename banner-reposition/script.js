(function () {
    const DEFAULT_IMAGE_SOURCE = "https://cdn.wallpapersafari.com/28/71/L4NmYV.png"
    const ZOOM_MAX = 4
    let zoom_min = 1
    let zoomLevel = zoom_min;
    const image = document.getElementById("uploaded-img")
    const zoomInBtn = document.getElementById("zoom-in")
    const zoomOutBtn = document.getElementById("zoom-out")
    const fileInput = document.querySelector('input[type="file"]')
    const saveBtn = document.querySelector("#save")
    const repositionBtn = document.querySelector("#reposition")
    const bannerContainer = document.querySelector(".banner")
    const spinner = document.querySelector(".spinner-circle")

    let isEditing = false
    let isMouseDown = false
    let offset = [0, 0]     // x, y
    let mousePos

    // set initial img, zoom level and position taken from local storage (if available)
    const initialPosition = localStorage.getItem("position") || "0,0"
    function zoom(level, isZoomOut = false) {
        console.log(level);
        if (isEditing) {
            if (level >= zoom_min && level <= ZOOM_MAX) {
                const oldWidth = image.clientWidth
                const oldHeight = image.clientHeight
                image.style.width = (100 * level) + "%"
                zoomLevel = level

                if (isZoomOut) {
                    console.log(image.offsetLeft + (oldWidth - image.clientWidth));
                    if (image.offsetLeft + (oldWidth - image.clientWidth) <= 0) {
                        image.style.left = image.offsetLeft + (oldWidth - image.clientWidth) + "px"
                    }
                    if (image.offsetTop + (oldHeight - image.clientHeight) <= 0) {
                        image.style.top = image.offsetTop + (oldHeight - image.clientHeight) + "px"
                    }
                }

                // if this zoom level is as small as it could be 
                if (zoomLevel - 0.1 < zoom_min) {
                    image.style.left = 0
                    image.style.top = 0
                }
            }
        }
    }

    // function to zoom image when it is just uploaded to fit the container
    function initialZoom(level) {
        console.log(level);
        zoom_min = level
        zoomLevel = zoom_min
        image.style.width = (100 * level) + "%"
    }

    image.src = localStorage.getItem("image-source") || DEFAULT_IMAGE_SOURCE
    image.style.width = "100%"
    image.style.left = initialPosition.split(",")[0] + "px"
    image.style.top = initialPosition.split(",")[1] + "px"
    setTimeout(() => {
        const heightPortion = bannerContainer.clientHeight / image.clientHeight
        zoomLevel = parseFloat(localStorage.getItem("zoom")) || (heightPortion > 1 ? heightPortion : 1)
        initialZoom(zoomLevel)
    }, 200);


    // Upload File
    fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
            spinner.classList.add("show")
            // const fileReader = new FileReader()
            // fileReader.onload = () => {
            //     image.src = fileReader.result
            //     image.style.left = 0
            //     image.style.top = 0
            //     image.style.width = "100%"
            //     const heightPortion = bannerContainer.clientHeight / image.clientHeight
            //     initialZoom(heightPortion > 1 ? heightPortion : 1)
            // }
            // fileReader.readAsDataURL(e.target.files[0])

            // UPLOAD TO REMOTE IMAGE HOSTING SITE (IMGUR)
            const formdata = new FormData()
            formdata.append("image", e.target.files[0])
            fetch("https://api.imgur.com/3/image/", {
                method: "POST",
                headers: {
                    Authorization: "Client-ID 013f9e60ad9f152"
                },
                body: formdata
            })
                .then(res => {
                    if (res.status === 200 || res.ok) {
                        return res.json()
                    }
                    else {
                        alert("Unable to upload image")
                        spinner.classList.remove("show")
                    }
                })
                .then(data => {
                    console.log(data.data.link);
                    image.src = data.data.link
                    image.style.left = 0
                    image.style.top = 0
                    image.style.width = "100%"
                    // set time out for image to finish loading into html
                    setTimeout(() => {
                        const heightPortion = bannerContainer.clientHeight / image.clientHeight
                        initialZoom(heightPortion > 1 ? heightPortion : 1)
                        spinner.classList.remove("show")
                    }, 500)
                })
                .catch(err => console.log(err))
        }
    })


    //  Reposition using mouse movement
    image.addEventListener("mousedown", (e) => {
        isMouseDown = true
        // e.clientX : mouse down z position relative to the html page
        // mage.offsetLeft: position of the image relative to the html page
        offset = [image.offsetLeft - e.clientX, image.offsetTop - e.clientY]
    })

    image.addEventListener("mouseup", () => {
        isMouseDown = false
    })

    image.addEventListener("mouseleave", () => {
        isMouseDown = false
    })

    image.addEventListener("mousemove", (e) => {
        if (isMouseDown && isEditing) {
            mousePos = [e.clientX, e.clientY]
            const newLeft = mousePos[0] + offset[0]
            const newTop = mousePos[1] + offset[1]
            if (newLeft <= 0 && newLeft >= bannerContainer.clientWidth - image.clientWidth) {
                image.style.left = mousePos[0] + offset[0] + 'px'
            }
            if (newTop <= 0 && newTop >= bannerContainer.clientHeight - image.clientHeight) {
                image.style.top = mousePos[1] + offset[1] + 'px'
            }
        }
    })

    function toggleReposition(isOn) {
        isEditing = isOn
        if (isEditing) {
            zoomInBtn.removeAttribute("disabled")
            zoomOutBtn.removeAttribute("disabled")
            repositionBtn.innerHTML = "Cancel"
        }
        else {
            zoomInBtn.setAttribute("disabled", true)
            zoomOutBtn.setAttribute("disabled", true)
            repositionBtn.innerHTML = "Reposition"
        }
    }

    repositionBtn.addEventListener("click", () => {
        isEditing = !isEditing
        toggleReposition(isEditing)
    })

    // save current position and zoom status in localstorage when click save
    saveBtn.addEventListener("click", () => {
        localStorage.setItem("position", [image.offsetLeft, image.offsetTop])
        localStorage.setItem("zoom", zoomLevel)
        localStorage.setItem("image-source", image.src)

        // turn off reposition
        toggleReposition(false)
    })

    zoomInBtn.addEventListener("click", () => zoom(zoomLevel + 0.1))
    zoomOutBtn.addEventListener("click", () => zoom(zoomLevel - 0.1, true))

    // --------------------------------------------------
    //  Zoom in and out (scale)
    image.addEventListener("wheel", (e) => {
        // on mouse wheel up (zoom in), deltaY < 0, and vice versa
        // add 0.1 if delta < 0 (zoom in), else substract 0.1
        const zoomAmount = 0.1 * (e.deltaY < 0 || -1)
        zoom(zoomLevel + zoomAmount, e.deltaY > 0)
    })
})()
