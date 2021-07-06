(function () {
    const image = document.querySelector(".banner__image")

    // set initial img, zoom level and position taken from local storage (if available)
    const uploadedImage = document.querySelector('#uploaded-img');
    const defaultImageSrc = "https://images.wallpaperscraft.com/image/city_art_sky_127834_1600x900.jpg"
    const initialPosition = localStorage.getItem("position") || "0,0"
    let zoomLevel = localStorage.getItem("zoom") || 1

    uploadedImage.src = localStorage.getItem("image-source") || defaultImageSrc
    uploadedImage.style.left = initialPosition.split(",")[0] + "px"
    uploadedImage.style.top = initialPosition.split(",")[1] + "px"
    uploadedImage.style.transform = "scale(" + zoomLevel + ")"

    // --------------------------------------------------
    // Upload File
    const fileInput = document.querySelector('input[type="file"]')

    fileInput.addEventListener("change", (e) => {        
        if (e.target.files && e.target.files[0]) {
            const fileReader = new FileReader()
            fileReader.onload = () => {
                uploadedImage.src = fileReader.result
            }
            fileReader.readAsDataURL(e.target.files[0])
        }
    })


    // --------------------------------------------------
    //  Reposition using mouse movement
    const repositionBtn = document.querySelector("#reposition")
    const saveBtn = document.querySelector("#save")
    let isEditing = false
    let isMouseDown = false
    let offset = [0, 0]     // x, y
    let mousePos

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
            image.style.left = mousePos[0] + offset[0] + 'px'
            image.style.top = mousePos[1] + offset[1] + 'px'
        }
    })
    
    repositionBtn.addEventListener("click", () => {
        isEditing = !isEditing
        repositionBtn.innerHTML = isEditing ? "Cancel" : "Reposition"
    })

    // save current position and zoom status in localstorage when click save
    saveBtn.addEventListener("click", () => {
        localStorage.setItem("position", [image.offsetLeft, image.offsetTop])
        localStorage.setItem("zoom", zoomLevel)
        localStorage.setItem("image-source", uploadedImage.src)

        // turn off reposition
        isEditing = false
        repositionBtn.innerHTML = "Reposition"
    })


    // --------------------------------------------------
    //  Zoom in and out (scale)
    image.addEventListener("wheel", (e) => {
        if (isEditing) {
            // get current scale value 
            // boundindRect returns the actual dimenstion (scaled), offsetWidth returns unscaled dimension
            let scale = image.getBoundingClientRect().width / image.offsetWidth;
            scale = Math.round(scale * 10) / 10

            // on mouse wheel up (zoom in), deltaY < 0, and vice versa
            // add 0.1 if delta < 0 (zoom in), else substract 0.1
            zoomLevel = scale + 0.1 * (e.deltaY < 0 || -1)

            // scale range 1 to 4
            if (zoomLevel >= 1 && zoomLevel <= 4) {
                image.style.transform = "scale(" + zoomLevel + ")"
            }
        }

    })
})()
