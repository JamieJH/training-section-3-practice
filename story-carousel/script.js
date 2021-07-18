(function () {
    // Variables regarding file upload
    const form = document.querySelector(".upload-form")
    const storySelect = form.querySelector("#story-select")
    const storyName = form.querySelector("#story-name")
    const fileInput = document.querySelector('input[type="file"]')
    const addButton = document.querySelector("button#add")
    const storyFiles = {}

    // Variables regarding Story and Slide 
    const storyCarousel = document.querySelector(".story-carousel")
    const track = storyCarousel.querySelector(".carousel-track")
    const previsouButton = storyCarousel.querySelector(".carousel-button.previous")
    const nextButton = storyCarousel.querySelector(".carousel-button.next")
    const progressBars = storyCarousel.querySelector(".progress-bar-container")

    // Variables regarding Auto Slide
    const MAX_FILE_LIMIT_MB = 20
    const DEFAULT_SLIDE_INTERVAL = 6000
    let currentSlideDuration
    let slideIntervalId;
    let slideTimeoutId;
    let fillProgressBarIntervalId;
    let currentProgressBarIndex = 0;
    let currentInnerProgressBarWidth = 0;
    let isAutoPlaying = false;
    let timePassedEachSlide = 0;

    function setupStoryInputSelect() {
        storySelect.innerHTML = `
            <option value="">--- Choose story ---</option>
            <option value="new">CREATE NEW STORY</option>
        `

        Object.keys(storyFiles).forEach(title => {
            storySelect.innerHTML += `<option value="${title}">${title}</option>`
        })
    }

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

    function createStorySlideElement(storyTitle, slideInfo) {
        let storyContainer = track.querySelector("#" + storyTitle);

        // the story has only 1 slide when the story is created for the first time
        if (storyFiles[storyTitle].length === 1) {
            storyContainer = document.createElement("DIV");
            storyContainer.className = "user-story " + (track.children.length === 1 ? "active" : "")
            storyContainer.id = storyTitle
        }

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
            Your browser does not support the video tag.
            `
        }

        slideContainer.setAttribute("id", slideInfo.id)
        slideContainer.appendChild(media)
        storyContainer.appendChild(slideContainer)
        if (storyFiles[storyTitle].length === 1) {
            const endSlide = document.getElementById("story-end")
            endSlide.before(storyContainer)
        }
    }


    function toggleActiveClass(oldACtiveItem, newActiveItem) {
        oldACtiveItem.classList.remove("active")
        newActiveItem.classList.add("active")
    }


    function toggleVideoPlayer(video, isPlayNow) {
        if (video && video.tagName.toLowerCase() === "video") {
            isPlayNow ? video.play() : video.pause()
        }
    }

    // during auto slide, update the progress bar
    function startAutoSlide(startWidth = 0) {
        if (!isAutoPlaying) {
            isAutoPlaying = true
            const timeLeft = currentSlideDuration - timePassedEachSlide
            fillRunningBar(Array.from(progressBars.children)[currentProgressBarIndex], startWidth)

            if (timeLeft !== currentSlideDuration) {
                slideTimeoutId = setTimeout(() => slideUsingButtons(true), timeLeft)
            }
            slideIntervalId = setInterval(() => slideUsingButtons(true), currentSlideDuration)

            toggleVideoPlayer(storyCarousel.querySelector(".user-story__slide.active > video"), true)
        }
    }


    function stopAutoSlide() {
        if (isAutoPlaying) {
            isAutoPlaying = false
            clearInterval(fillProgressBarIntervalId)
            clearTimeout(slideTimeoutId)
            clearInterval(slideIntervalId)
            toggleVideoPlayer(storyCarousel.querySelector(".user-story__slide.active > video"), false)
        }
    }

    function drawProgressBars(barCount) {
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
        currentInnerProgressBarWidth = startWidth

        fillProgressBarIntervalId = setInterval(() => {
            const changeAmountPer100s = progressBar.offsetWidth * 50 / currentSlideDuration + 0.02
            if (currentInnerProgressBarWidth <= progressBar.offsetWidth) {
                currentInnerProgressBarWidth += changeAmountPer100s
                progressBar.querySelector(".inner-bar").style.width = currentInnerProgressBarWidth + "px"
            }
            else {
                currentInnerProgressBarWidth = 0
                clearInterval(fillProgressBarIntervalId)
            }
            timePassedEachSlide += 50
        }, 50)
    }


    function moveToSlide(storyContainer, targetSlide, isNext, isSetupBarNecessary = false) {
        stopAutoSlide()
        const currentStory = storyCarousel.querySelector(".user-story.active")
        // if target slide is not specified, slide to first slide of story
        if (targetSlide === null) {
            targetSlide = storyContainer.querySelector(".user-story__slide")
            currentProgressBarIndex = 0
        }

        const currentVideo = currentStory.querySelector(".user-story__slide.active video")
        if (currentVideo) {
            currentVideo.pause()
        }

        const targetMedia = targetSlide.querySelector("video")
        if (targetMedia) {
            targetMedia.load()
            targetMedia.play()
        }

        if (isSetupBarNecessary) {
            drawProgressBars(storyContainer.children.length)
        }

        progressBars.style.visibility = (storyContainer.id === "story-end") ? 'hidden' : 'visible';

        const allBars = Array.from(progressBars.children)

        for (let i = 0; i < currentProgressBarIndex; i++) {
            allBars[i].querySelector(".inner-bar").style.width = "100%"
        }

        if (!isNext) {
            for (let i = currentProgressBarIndex; i < allBars.length; i++) {
                allBars[i].querySelector(".inner-bar").style.width = "0"
            }
        }

        track.style.transform = "translateX(-" + targetSlide.style.left + ")";
        toggleActiveClass(currentStory, storyContainer)
        toggleActiveClass(storyCarousel.querySelector(".user-story__slide.active"), targetSlide)
        timePassedEachSlide = 0

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

        let targetSlide = isNext ? activeSlide.nextElementSibling : activeSlide.previousElementSibling
        let siblingStory = null

        if (isNext) {
            stopAutoSlide()       // turn off auto slide in case user slide when progress bar was being filled
        }

        if (!targetSlide) {
            siblingStory = isNext ? activeStory.nextElementSibling : activeStory.previousElementSibling
            if (siblingStory) {
                targetSlide = isNext ? siblingStory.querySelector(".user-story__slide:first-child") :
                    siblingStory.querySelector(".user-story__slide:last-child");

                currentProgressBarIndex = isNext ? 0 : siblingStory.children.length - 1
                moveToSlide(siblingStory, targetSlide, isNext, true)
            }
        }
        else {
            currentProgressBarIndex += isNext || -1
            moveToSlide(activeStory, targetSlide, isNext)
        }
    }

    storySelect.addEventListener("change", (e) => {
        const option = e.target.value;
        (option === "new") ? storyName.removeAttribute("disabled") : storyName.setAttribute("disabled", "true")
    })


    addButton.addEventListener("click", (e) => {
        e.preventDefault()
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

        let isAllInSizeLimit = true;
        let enteredStoryTitle = storySelect.value === "new" ? storyName.value.trim().toLowerCase() : storySelect.value
        enteredStoryTitle = enteredStoryTitle.replace(/\s+/g, '-')

        if (storySelect.value === "new") {
            storyFiles[enteredStoryTitle] = []
        }

        // index at which files will be added, if story is new, lastIndex = 0
        let lastIndex = storyFiles[enteredStoryTitle].length

        Array.from(fileInput.files).every(file => {
            if (file.size > MAX_FILE_LIMIT_MB * 1024 * 1024) {
                alert("Some file size is larger than 20MB");
                isAllInSizeLimit = false
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
            createStorySlideElement(enteredStoryTitle, newSlide)
            lastIndex++
            return true
        })

        if (isAllInSizeLimit) {
            positionSlides()
            moveToSlide(storyCarousel.querySelector("#" + enteredStoryTitle), null, true, true)
            setupStoryInputSelect()

            storyCarousel.style.display = "block"

            storyName.value = ""
            fileInput.value = ""
        }
    })

    track.addEventListener("mousedown", stopAutoSlide)
    track.addEventListener("mouseleave", () => startAutoSlide(currentInnerProgressBarWidth))
    track.addEventListener("mouseup", () => startAutoSlide(currentInnerProgressBarWidth))
    previsouButton.addEventListener("click", () => slideUsingButtons(false))
    nextButton.addEventListener("click", () => slideUsingButtons(true))

    setupStoryInputSelect()

})()
