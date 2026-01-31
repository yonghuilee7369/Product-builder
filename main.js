// Teachable Machine model URL
const URL = "https://teachablemachine.withgoogle.com/models/3TI-L38Mc/";

let model, webcam, labelContainer, maxPredictions;

// Load the image model and setup the webcam
async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    // load the model and metadata
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    // setup webcam
    const flip = true; // whether to flip the webcam
    webcam = new tmImage.Webcam(300, 300, flip); // width, height, flip
    await webcam.setup(); // request access to the webcam
    await webcam.play();
    window.requestAnimationFrame(loop);

    // append elements to the DOM
    document.getElementById("webcam-container").appendChild(webcam.canvas);
    labelContainer = document.getElementById("label-container");
    for (let i = 0; i < maxPredictions; i++) { // and class labels
        const div = document.createElement("div");
        const barContainer = document.createElement("div");
        barContainer.className = "result-bar-container";
        const bar = document.createElement("div");
        bar.className = "result-bar";
        const span = document.createElement("span");

        barContainer.appendChild(bar);
        div.appendChild(span);
        div.appendChild(barContainer);
        labelContainer.appendChild(div);
    }

    // hide the start button
    document.getElementById("start-button").style.display = "none";
}

async function loop() {
    webcam.update(); // update the webcam frame
    await predict();
    window.requestAnimationFrame(loop);
}

// run the webcam image through the image model
async function predict() {
    // predict can take in an image, video or canvas html element
    const prediction = await model.predict(webcam.canvas);
    for (let i = 0; i < maxPredictions; i++) {
        const classPrediction =
            prediction[i].className + ": " + prediction[i].probability.toFixed(2);
        const bar = labelContainer.childNodes[i].querySelector(".result-bar");
        const span = labelContainer.childNodes[i].querySelector("span");
        
        span.innerHTML = classPrediction;
        bar.style.width = prediction[i].probability * 100 + "%";

        if(prediction[i].className === "강아지") {
            bar.classList.add("dog-bar");
        } else if (prediction[i].className === "고양이") {
            bar.classList.add("cat-bar");
        }
    }
}
