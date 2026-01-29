document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-btn');
    const resultDiv = document.getElementById('result');

    calculateBtn.addEventListener('click', () => {
        const purchasePrice = parseFloat(document.getElementById('purchase-price').value);
        const sellingPrice = parseFloat(document.getElementById('selling-price').value);
        const shares = parseInt(document.getElementById('shares').value);

        if (isNaN(purchasePrice) || isNaN(sellingPrice) || isNaN(shares) || purchasePrice <= 0 || sellingPrice <= 0 || shares <= 0) {
            resultDiv.innerHTML = '<p style="color: red;">Please enter valid numbers for all fields.</p>';
            return;
        }

        const totalInvestment = purchasePrice * shares;
        const totalSale = sellingPrice * shares;
        const profitOrLoss = totalSale - totalInvestment;
        const roi = (profitOrLoss / totalInvestment) * 100;

        let resultHTML = `<p>Total Investment: $${totalInvestment.toFixed(2)}</p>`;
        resultHTML += `<p>Total Sale: $${totalSale.toFixed(2)}</p>`;

        if (profitOrLoss >= 0) {
            resultHTML += `<p style="color: green;">Profit: $${profitOrLoss.toFixed(2)}</p>`;
            resultHTML += `<p style="color: green;">Return on Investment (ROI): ${roi.toFixed(2)}%</p>`;
        } else {
            resultHTML += `<p style="color: red;">Loss: $${Math.abs(profitOrLoss).toFixed(2)}</p>`;
            resultHTML += `<p style="color: red;">Return on Investment (ROI): ${roi.toFixed(2)}%</p>`;
        }

        resultDiv.innerHTML = resultHTML;
    });
});