const URL = "https://teachablemachine.withgoogle.com/models/3TI-L38Mc/";

let model, labelContainer, maxPredictions;

const imageUpload = document.getElementById("image-upload");
const predictButton = document.getElementById("predict-button");
const uploadedImage = document.getElementById("uploaded-image");
labelContainer = document.getElementById("label-container");

async function init() {
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses();

    for (let i = 0; i < maxPredictions; i++) {
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
}

init();

imageUpload.addEventListener("change", (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedImage.src = e.target.result;
    };
    reader.readAsDataURL(file);
});

predictButton.addEventListener("click", async () => {
    if (uploadedImage.src) {
        await predict();
    } else {
        alert("Please upload an image first.");
    }
});

async function predict() {
    const prediction = await model.predict(uploadedImage);
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
