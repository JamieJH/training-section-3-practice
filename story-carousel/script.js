(function () {

    // --------------------------------------------------
    // Upload Files
    const form = document.querySelector(".upload-form")
    const storySelect = form.querySelector("#story-select")
    const storyName = form.querySelector("#story-name")
    const fileInput = document.querySelector('input[type="file"]')
    const addBtn = document.querySelector("button#add")
    const storyFiles = {}

    // Story and Slide 
    const storyCarousel = document.querySelector(".story-carousel")
    const track = storyCarousel.querySelector(".carousel-track")
    const previsouBtn = storyCarousel.querySelector(".carousel-button.previous")
    const nextBtn = storyCarousel.querySelector(".carousel-button.next")
    const progressBars = storyCarousel.querySelector(".progress-bar-container")

    // Auto Slide variables
    const DEFAULT_SLIDE_INTERVAL = 6000     // time between each slide (for auto sliding)
    let currentSlideDuration                // time duration for the current slide
    let slideIntervalId;                    // id of setInterval that before moving to the next slide
    let slideTimeoutId;                     // id of setTimeout to slide the remaining time after stop
    let fillProgressBarIntervalId;          // id of setInterval to fill progress bar during SLIDE_INTERVAL
    let currentBarIndex = 0;                // index of the progres bar to be filled
    let currentInnerWidth = 0;              // filled width of the current progress bar
    let isAutoPlaying = false;              // true is auto play is on
    let timePassed = 0;                     // time passed since the start of slide when user pause auto play

    // set up story select input
    function setupStorySelect() {
        storySelect.innerHTML = `
            <option value="">--- Choose story ---</option>
            <option value="new">CREATE NEW STORY</option>`

        Object.keys(storyFiles).forEach(title => {
            storySelect.innerHTML += `<option value="${title}">${title}</option>`
        })
    }

    // position slides next to each other
    function positionSlides() {
        let totalSlides = 0
        const userStories = storyCarousel.querySelectorAll(".user-story")
        userStories.forEach(story => {
            const slides = story.querySelectorAll(".user-story__slide")
            slides.forEach((slide, slideIndex) => {
                slide.style.left = (slideIndex + totalSlides) * 100 + "%"
            })
            totalSlides += slides.length
        })
    }

    // create a story slide html element 
    function createStorySlide(storyTitle, slideInfo) {
        let storyContainer = track.querySelector("#" + storyTitle);

        // if this function is called when the story only has 1 slide, create the story container
        if (storyFiles[storyTitle].length === 1) {
            storyContainer = document.createElement("DIV");
            storyContainer.className = "user-story " + (track.children.length === 1 ? "active" : "")
            storyContainer.id = storyTitle
        }

        // create the slide container that contain the image/video
        const slideContainer = document.createElement("DIV")
        // if this is the first ever story and frist ever slide, set the slide to active
        slideContainer.className = "user-story__slide " +
            ((track.children.length === 1 && storyFiles[storyTitle].length === 1) ? "active" : "");

        let media = ""
        if (slideInfo.type === "image") {
            media = document.createElement("IMG")
            media.className = "user-story__slide-media"
            media.setAttribute("alt", slideInfo.name)
            media.setAttribute("src", slideInfo.src)
            media.setAttribute("draggable", false)
        }
        else {
            media = document.createElement("VIDEO")
            media.className = "user-story__slide-media"
            media.setAttribute("width", 400)
            media.setAttribute("height", 700)

            media.innerHTML = `
            <source src="${slideInfo.src}" type="video/mp4">
            <source src="${slideInfo.src}" type="video/mkv">
            Your browser does not support the video tag.`
        }

        slideContainer.setAttribute("id", slideInfo.id)
        slideContainer.appendChild(media)
        storyContainer.appendChild(slideContainer)
        if (storyFiles[storyTitle].length === 1) {
            const endSlide = document.getElementById("story-end")
            endSlide.before(storyContainer)
        }
    }


    // function to remove/add active class for slide container and slide
    function toggleActiveClass(oldACtiveItem, newActiveItem) {
        oldACtiveItem.classList.remove("active")
        newActiveItem.classList.add("active")
    }


    // function to play/pause a video, isPlayNow = true if the video should be played, otherwise false
    function toggleVideo(video, isPlayNow) {
        if (video && video.tagName.toLowerCase() === "video") {
            isPlayNow ? video.play() : video.pause()
        }
    }

    // set auto slide after 6s, during this time, update the progress bar
    function startAutoSlide(startWidth = 0) {
        if (!isAutoPlaying) {
            isAutoPlaying = true
            const timeLeft = currentSlideDuration - timePassed
            fillRunningBar(Array.from(progressBars.children)[currentBarIndex], startWidth)

            if (timeLeft !== currentSlideDuration) {
                slideTimeoutId = setTimeout(() => slideUsingButtons(true), timeLeft)
            }
            slideIntervalId = setInterval(() => slideUsingButtons(true), currentSlideDuration)

            // if active slide contain a video, play it
            toggleVideo(storyCarousel.querySelector(".user-story__slide.active > video"), true)
        }
    }


    function stopAutoSlide() {
        if (isAutoPlaying) {
            isAutoPlaying = false
            clearInterval(fillProgressBarIntervalId)
            clearTimeout(slideTimeoutId)
            clearInterval(slideIntervalId)
            // if active slide contain a video, pause it
            toggleVideo(storyCarousel.querySelector(".user-story__slide.active > video"), false)
        }
    }

    function setUpProgressBars(barCount) {
        // draw progress bar
        progressBars.innerHTML = ""
        for (let i = 0; i < barCount; i++) {
            progressBars.innerHTML += `
            <div class="progress-bar" 
                style="width: calc(100% / ${barCount} - 3px); ">
                <div class="bar outer-bar"></div>
                <div class="bar inner-bar"></div>
            </div>
            `
        }
    }

    function fillRunningBar(progressBar, startWidth = 0) {
        // clear old interval
        currentInnerWidth = startWidth

        fillProgressBarIntervalId = setInterval(() => {
            // the amount of px being added to running bar width every 100s
            const changeAmountPer100s = progressBar.offsetWidth * 50 / currentSlideDuration + 0.02
            if (currentInnerWidth <= progressBar.offsetWidth) {
                currentInnerWidth += changeAmountPer100s
                progressBar.querySelector(".inner-bar").style.width = currentInnerWidth + "px"
            }
            else {
                currentInnerWidth = 0
                clearInterval(fillProgressBarIntervalId)
            }
            timePassed += 50
        }, 50)
    }


    function moveToSlide(storyContainer, targetSlide, isNext, isSetupBarNecessary = false) {
        stopAutoSlide()
        const currentStory = storyCarousel.querySelector(".user-story.active")
        // if target slide is not specified, slide to first slide of story
        if (targetSlide === null) {
            targetSlide = storyContainer.querySelector(".user-story__slide")
            currentBarIndex = 0
        }

        // pause current slide video if it is a video
        const currentVideo = currentStory.querySelector(".user-story__slide.active video")
        if (currentVideo) {
            currentVideo.pause()
        }

        // reload and play video if target slide is a video 
        const targetMedia = targetSlide.querySelector("video")
        if (targetMedia) {
            targetMedia.load()
            targetMedia.play()
        }

        if (isSetupBarNecessary) {
            setUpProgressBars(storyContainer.children.length)
        }

        // hide progress bars for the end black slide
        progressBars.style.visibility = (storyContainer.id === "story-end") ? 'hidden' : 'visible';

        const allBars = Array.from(progressBars.children)

        // fully fill previous progress bars 
        for (let i = 0; i < currentBarIndex; i++) {
            allBars[i].querySelector(".inner-bar").style.width = "100%"
        }

        // if user go back, unfill the following progress bars
        if (!isNext) {
            for (let i = currentBarIndex; i < allBars.length; i++) {
                allBars[i].querySelector(".inner-bar").style.width = "0"
            }
        }

        track.style.transform = "translateX(-" + targetSlide.style.left + ")";
        toggleActiveClass(currentStory, storyContainer)
        toggleActiveClass(storyCarousel.querySelector(".user-story__slide.active"), targetSlide)
        timePassed = 0

        currentSlideDuration = DEFAULT_SLIDE_INTERVAL
        if (!targetSlide.classList.contains("end")) {
            const [storyTitle, slideIndex] = targetSlide.getAttribute('id').split('_')
            currentSlideDuration = storyFiles[storyTitle][slideIndex].duration
        }
        startAutoSlide()
    }


    function slideUsingButtons(isNext) {
        let activeStory = storyCarousel.querySelector(".user-story.active")
        let activeSlide = activeStory.querySelector(".active")

        // get previous or next slide as target slide
        let targetSlide = isNext ? activeSlide.nextElementSibling : activeSlide.previousElementSibling
        let siblingStory = null

        if (isNext) {
            stopAutoSlide()       // turn off auto slide in case user slide when progress bar was being filled
        }

        // if there's no sibling slide, check for sibling story
        if (!targetSlide) {
            siblingStory = isNext ? activeStory.nextElementSibling : activeStory.previousElementSibling
            // if there's sibling story, set target slide to first slide of that story (next), or last if previous
            if (siblingStory) {
                targetSlide = isNext ? siblingStory.querySelector(".user-story__slide:first-child") :
                    siblingStory.querySelector(".user-story__slide:last-child");

                // get index of progress bar to later fill it
                currentBarIndex = isNext ? 0 : siblingStory.children.length - 1

                // move to the target slide, and set new active for target slide and sibling story
                moveToSlide(siblingStory, targetSlide, isNext, true)
            }
        }
        else {
            currentBarIndex += isNext || -1                 // get index of progress bar to later fill it
            moveToSlide(activeStory, targetSlide, isNext)   // move to target slide, and set it to active   
        }
    }

    // disable the story name input text field if user select an available story
    storySelect.addEventListener("change", (e) => {
        const option = e.target.value;
        (option === "new") ? storyName.removeAttribute("disabled") : storyName.setAttribute("disabled", "true")
    })


    addBtn.addEventListener("click", (e) => {
        e.preventDefault()
        // deal with input error
        if (storySelect.value === "") {
            alert("Please choose a story.")
            return
        }
        if (storySelect.value === "new" && storyName.value.trim() === "") {
            alert("Please add a title for your new story.")
            return
        }
        if (storySelect.value === "new" && storyFiles[storyName.value.trim().toLowerCase()]) {
            alert("Please enter a new unique story name.")
            return
        }
        if (fileInput.files.length === 0) {
            alert("Please upload some file(s).")
            return
        }

        // All inputs are correct
        let isAllGood = true;   // to check if all input is <= 20MB
        let enteredStoryTitle = storySelect.value === "new" ? storyName.value.trim().toLowerCase() : storySelect.value
        // replace any string of white space with a hyphen
        enteredStoryTitle = enteredStoryTitle.replace(/\s+/g, '-')

        if (storySelect.value === "new") {
            storyFiles[enteredStoryTitle] = []        // initialise an array
        }

        // index at which files will be added, if story is new, lastIndex = 0
        let lastIndex = storyFiles[enteredStoryTitle].length

        Array.from(fileInput.files).every(file => {
            // if file size > 5MB
            if (file.size > 20 * 1024 * 1024) {
                alert("Some file size is larger than 10MB");
                isAllGood = false
                return false
            }
            const newSlide = {
                id: enteredStoryTitle + "_" + lastIndex,
                name: file.name,
                src: URL.createObjectURL(file),
                type: file.type.split("/")[0],
                duration: 1000 * (Math.floor(Math.random() * 6) + 5)     // randomly set duration from 5s - 10s
            }
            storyFiles[enteredStoryTitle].push(newSlide)
            createStorySlide(enteredStoryTitle, newSlide)
            lastIndex++
            return true
        })

        if (isAllGood) {
            positionSlides()            // positions slides    
            moveToSlide(storyCarousel.querySelector("#" + enteredStoryTitle), null, true, true)       // move to the story first slide
            setupStorySelect()          // update the select box

            storyCarousel.style.display = "block"       // display story carousel

            // clear inputs 
            storyName.value = ""
            fileInput.value = ""
        }
    })

    track.addEventListener("mousedown", stopAutoSlide)
    track.addEventListener("mouseleave", () => startAutoSlide(currentInnerWidth))
    track.addEventListener("mouseup", () => startAutoSlide(currentInnerWidth))
    previsouBtn.addEventListener("click", () => slideUsingButtons(false))
    nextBtn.addEventListener("click", () => slideUsingButtons(true))

    setupStorySelect()

})()
