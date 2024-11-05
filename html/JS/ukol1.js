/*document.addEventListener('DOMContentLoaded', function() {
    // Obslužná funkce pro formulář
    document.getElementById('diveForm').addEventListener('submit', function(event) {
        event.preventDefault();

        // Získání hodnot od uživatele
        let depth = parseFloat(document.getElementById('depth').value);
        let time = parseFloat(document.getElementById('time').value);
        let gasType = document.getElementById('gas').value;
        let gfLow = parseFloat(document.getElementById('gfLow').value);
        let gfHigh = parseFloat(document.getElementById('gfHigh').value);
        let airConsumption = parseFloat(document.getElementById('airConsumption').value);
        let tankVolume = parseFloat(document.getElementById('tankVolume').value);
        let startPressure = parseFloat(document.getElementById('startPressure').value);

        // Validace vstupů
        if (isNaN(depth) || isNaN(time) || isNaN(gfLow) || isNaN(gfHigh) || isNaN(airConsumption) || isNaN(tankVolume) || isNaN(startPressure)) {
            alert("Prosím zadejte platné hodnoty.");
            return;
        }

        // Vypočítáme celkový objem vzduchu na základě tlaku a objemu lahve
        let totalAirInTank = calculateTotalAirInTank(tankVolume, startPressure);

        // Generování dat pro graf s dekompresními zastávkami
        let chartData = generateDiveProfile(depth, time, gasType, gfLow, gfHigh);

        // Výpočet spotřeby vzduchu
        let airUsed = calculateAirConsumption(depth, time, airConsumption);

        // Vykreslení grafu
        drawChart(chartData);

        // Zobrazení výsledku spotřeby vzduchu
        displayAirUsage(airUsed, totalAirInTank);
    });

    // Funkce pro výpočet celkového objemu vzduchu v lahvi na základě tlaku a objemu
    function calculateTotalAirInTank(tankVolume, startPressure) {
        return tankVolume * startPressure; // Celkový objem vzduchu v litrech
    }

    // Výpočet spotřeby vzduchu
    function calculateAirConsumption(depth, time, airConsumption) {
        let pressureAtDepth = (depth / 10) + 1; // Absolutní tlak v barech (hloubka/10 + povrchový tlak)
        let consumptionAtDepth = airConsumption * pressureAtDepth; // Spotřeba při dané hloubce
        let totalAirUsed = consumptionAtDepth * time; // Celková spotřeba vzduchu

        return totalAirUsed; // Vrátí celkovou spotřebu vzduchu v litrech
    }

    // Funkce pro zobrazení výsledku spotřeby vzduchu
    function displayAirUsage(airUsed, totalAirInTank) {
        let remainingAir = totalAirInTank - airUsed;
        let airResult = document.getElementById('airResult');

        // Pokud prvek pro zobrazení výsledku neexistuje, vytvoříme ho
        if (!airResult) {
            airResult = document.createElement('div');
            airResult.id = 'airResult';
            document.body.appendChild(airResult);
        }

        // Zobrazíme výsledek spotřeby vzduchu
        if (remainingAir >= 0) {
            airResult.innerHTML = `Spotřebovaný vzduch: ${airUsed.toFixed(2)} litrů.<br> Zbývající vzduch: ${remainingAir.toFixed(2)} litrů.`;
        } else {
            airResult.innerHTML = `Spotřebovaný vzduch: ${airUsed.toFixed(2)} litrů.<br> Upozornění: Nedostatečné množství vzduchu! Chybí ${Math.abs(remainingAir).toFixed(2)} litrů.`;
        }
    }

    // Funkce pro generování profilu ponoru
    function generateDiveProfile(depth, time, gasType, gfLow, gfHigh) {
        let data = [];
        let currentTime = 0;
        let timeStep = 0.1; // Časový krok v minutách

        // Konfigurace plynu
        let gas = configureGas(gasType);

        // Počáteční parciální tlaky v tkáních (dusík)
        let tissues = new Array(16).fill(gas.n2Fraction * (depthToPressure(0) - 0.0627));

        // Sestup
        let descentRate = 18;  // Rychlost sestupu v m/min
        let descentTime = depth / descentRate;

        for (let t = 0; t <= descentTime; t += timeStep) {
            let currentDepth = t * descentRate;
            if (currentDepth > depth) currentDepth = depth;
            let ambientPressure = depthToPressure(currentDepth);

            // Aktualizace parciálních tlaků v tkáních
            tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);

            data.push({ x: currentTime, y: currentDepth });
            currentTime += timeStep;
        }

        // Setrvání v hloubce
        let bottomTime = time;
        let bottomEndTime = currentTime + bottomTime;

        for (; currentTime <= bottomEndTime; currentTime += timeStep) {
            let ambientPressure = depthToPressure(depth);
            tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
            data.push({ x: currentTime, y: depth });
        }

        // Výpočet dekompresních zastávek
        let maxAmbientPressure = depthToPressure(depth);
        let decoPlan = calculateDecoPlan(tissues.slice(), gas.n2Fraction, gfLow, gfHigh, maxAmbientPressure);

        // Výstup s dekompresními zastávkami
        let ascentRate = 9;  // Rychlost výstupu v m/min
        let ascentDepth = depth;

        for (let stop of decoPlan) {
            // Výstup k další zastávce
            let targetDepth = stop.depth;
            let depthDifference = ascentDepth - targetDepth;
            let ascentTime = depthDifference / ascentRate;

            for (let t = 0; t <= ascentTime; t += timeStep) {
                let currentDepth = ascentDepth - (t * ascentRate);
                if (currentDepth < targetDepth) currentDepth = targetDepth;
                let ambientPressure = depthToPressure(currentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: currentDepth });
                currentTime += timeStep;
            }

            ascentDepth = targetDepth;

            // Setrvání na zastávce
            let stopTime = stop.time;
            let stopEndTime = currentTime + stopTime;

            for (; currentTime <= stopEndTime; currentTime += timeStep) {
                let ambientPressure = depthToPressure(ascentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: ascentDepth });
            }
        }

        // Výstup na hladinu
        if (ascentDepth > 0) {
            let ascentTime = ascentDepth / ascentRate;
            for (let t = 0; t <= ascentTime; t += timeStep) {
                let currentDepth = ascentDepth - (t * ascentRate);
                if (currentDepth < 0) currentDepth = 0;
                let ambientPressure = depthToPressure(currentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: currentDepth });
                currentTime += timeStep;
            }
        }

        // Poslední bod: hladina
        data.push({ x: currentTime, y: 0 });

        return data;
    }

    // Funkce pro konfiguraci plynu
    function configureGas(gasType) {
        let o2Fraction, n2Fraction;
        switch(gasType) {
            case 'air':
                o2Fraction = 0.21;
                n2Fraction = 0.79;
                break;
            case 'nitrox32':
                o2Fraction = 0.32;
                n2Fraction = 0.68;
                break;
            case 'nitrox36':
                o2Fraction = 0.36;
                n2Fraction = 0.64;
                break;
            default:
                o2Fraction = 0.21;
                n2Fraction = 0.79;
        }
        return { o2Fraction, n2Fraction };
    }

    // Funkce pro aktualizaci parciálních tlaků v tkáních
    function updateTissues(tissues, ambientPressure, n2Fraction, timeStep) {
        let newTissues = [];
        let inspiredN2Pressure = (ambientPressure - 0.0627) * n2Fraction; // 0.0627 bar je tlak vodní páry

        for (let i = 0; i < tissues.length; i++) {
            let halfTime = tissueHalfTimes[i];
            let k = Math.log(2) / halfTime;
            let oldPressure = tissues[i];
            let newPressure = oldPressure + (inspiredN2Pressure - oldPressure) * (1 - Math.exp(-k * timeStep));
            newTissues.push(newPressure);
        }

        return newTissues;
    }

    // Funkce pro vykreslení grafu
    function drawChart(data) {
        let ctx = document.getElementById('diveChart').getContext('2d');

        // Zničení předchozí instance grafu, pokud existuje
        if (window.diveChartInstance) {
            window.diveChartInstance.destroy();
        }

        // Vykreslení nového grafu
        window.diveChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Profil ponoru',
                    data: data,
                    borderColor: '#51a3a3',
                    fill: false,
                    pointRadius: 0,
                    lineTension: 0
                }]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Čas (min)'
                        },
                        type: 'linear',
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Hloubka (m)'
                        },
                        reverse: true,
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Definice tkáňových poločasů pro ZHL-16C (v minutách)
    const tissueHalfTimes = [4.0, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3,
                             77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0];

    // Definice hodnot "a" a "b" pro M-hodnoty (ZHL-16C)
    const tissueAValues = [1.2599, 1.0, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4701,
                           0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327];

    const tissueBValues = [0.5050, 0.6514, 0.7222, 0.7825, 0.8125, 0.8434, 0.8693, 0.8910,
                           0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653];

    // Výpočet dekompresního plánu a stropu zůstává beze změny
   
    console.log("Data pro graf:", chartData); // Debugging před voláním drawChart
    drawChart(chartData);
    
  
    // Funkce pro vykreslení grafu
function drawChart(data) {
    console.log("Vykresluji graf s následujícími daty:", data); // Debugging

    let ctx = document.getElementById('diveChart').getContext('2d');

    // Zničení předchozí instance grafu, pokud existuje
    if (window.diveChartInstance) {
        window.diveChartInstance.destroy();
    }

    // Vykreslení nového grafu
    window.diveChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Profil ponoru',
                data: data,
                borderColor: '#51a3a3',
                fill: false,
                pointRadius: 0,
                lineTension: 0
            }]
        },
        options: {
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Čas (min)'
                    },
                    type: 'linear',
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: 'Hloubka (m)'
                    },
                    reverse: true,
                    beginAtZero: true
                }
            }
        }
    });
}
 
});
*/

document.addEventListener('DOMContentLoaded', function() {
    // Obslužná funkce pro formulář
    document.getElementById('diveForm').addEventListener('submit', function(event) {
        event.preventDefault();

        // Získání hodnot od uživatele
        let depth = parseFloat(document.getElementById('depth').value);
        let time = parseFloat(document.getElementById('time').value);
        let gasType = document.getElementById('gas').value;
        let gfLow = parseFloat(document.getElementById('gfLow').value);
        let gfHigh = parseFloat(document.getElementById('gfHigh').value);
        let airConsumption = parseFloat(document.getElementById('airConsumption').value);
        let tankVolume = parseFloat(document.getElementById('tankVolume').value);
        let startPressure = parseFloat(document.getElementById('startPressure').value);

        // Validace vstupů
        if (isNaN(depth) || isNaN(time) || isNaN(gfLow) || isNaN(gfHigh) || isNaN(airConsumption) || isNaN(tankVolume) || isNaN(startPressure)) {
            alert("Prosím zadejte platné hodnoty.");
            return;
        }

        // Vypočítáme celkový objem vzduchu na základě tlaku a objemu lahve
        let totalAirInTank = calculateTotalAirInTank(tankVolume, startPressure);

        // Generování dat pro graf s dekompresními zastávkami
        let chartData = generateDiveProfile(depth, time, gasType, gfLow, gfHigh);

        // Výpočet spotřeby vzduchu
        let airUsed = calculateAirConsumption(depth, time, airConsumption);

        // Vykreslení grafu
        drawChart(chartData);

        // Zobrazení výsledku spotřeby vzduchu
        displayAirUsage(airUsed, totalAirInTank);
    });

    // Funkce pro výpočet celkového objemu vzduchu v lahvi na základě tlaku a objemu
    function calculateTotalAirInTank(tankVolume, startPressure) {
        return tankVolume * startPressure; // Celkový objem vzduchu v litrech
    }

    // Výpočet spotřeby vzduchu
    function calculateAirConsumption(depth, time, airConsumption) {
        let pressureAtDepth = (depth / 10) + 1; // Absolutní tlak v barech (hloubka/10 + povrchový tlak)
        let consumptionAtDepth = airConsumption * pressureAtDepth; // Spotřeba při dané hloubce
        let totalAirUsed = consumptionAtDepth * time; // Celková spotřeba vzduchu

        return totalAirUsed; // Vrátí celkovou spotřebu vzduchu v litrech
    }

    // Funkce pro zobrazení výsledku spotřeby vzduchu
    function displayAirUsage(airUsed, totalAirInTank) {
        let remainingAir = totalAirInTank - airUsed;
        let airResult = document.getElementById('airResult');

        // Pokud prvek pro zobrazení výsledku neexistuje, vytvoříme ho
        if (!airResult) {
            airResult = document.createElement('div');
            airResult.id = 'airResult';
            document.body.appendChild(airResult);
        }

        // Zobrazíme výsledek spotřeby vzduchu
        if (remainingAir >= 0) {
            airResult.innerHTML = `Spotřebovaný vzduch: ${airUsed.toFixed(2)} litrů.<br> Zbývající vzduch: ${remainingAir.toFixed(2)} litrů.`;
        } else {
            airResult.innerHTML = `Spotřebovaný vzduch: ${airUsed.toFixed(2)} litrů.<br> Upozornění: Nedostatečné množství vzduchu! Chybí ${Math.abs(remainingAir).toFixed(2)} litrů.`;
        }
    }

    // Funkce pro generování profilu ponoru
    function generateDiveProfile(depth, time, gasType, gfLow, gfHigh) {
        console.log("Generating dive profile with params:", { depth, time, gasType, gfLow, gfHigh });
        let data = [];
        let currentTime = 0;
        let timeStep = 0.1; // Časový krok v minutách

        // Konfigurace plynu
        let gas = configureGas(gasType);
        console.log("Gas configured:", gas);

        // Počáteční parciální tlaky v tkáních (dusík)
        let tissues = new Array(16).fill(gas.n2Fraction * (depthToPressure(0) - 0.0627));

        // Sestup
        let descentRate = 18;  // Rychlost sestupu v m/min
        let descentTime = depth / descentRate;

        for (let t = 0; t <= descentTime; t += timeStep) {
            let currentDepth = t * descentRate;
            if (currentDepth > depth) currentDepth = depth;
            let ambientPressure = depthToPressure(currentDepth);

            // Aktualizace parciálních tlaků v tkáních
            tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);

            data.push({ x: currentTime, y: currentDepth });
            currentTime += timeStep;
        }

        // Setrvání v hloubce
        let bottomTime = time;
        let bottomEndTime = currentTime + bottomTime;

        for (; currentTime <= bottomEndTime; currentTime += timeStep) {
            let ambientPressure = depthToPressure(depth);
            tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
            data.push({ x: currentTime, y: depth });
        }

        // Výpočet dekompresních zastávek
        let maxAmbientPressure = depthToPressure(depth);
        let decoPlan = calculateDecoPlan(tissues.slice(), gas.n2Fraction, gfLow, gfHigh, maxAmbientPressure);

        // Výstup s dekompresními zastávkami
        let ascentRate = 9;  // Rychlost výstupu v m/min
        let ascentDepth = depth;

        for (let stop of decoPlan) {
            // Výstup k další zastávce
            let targetDepth = stop.depth;
            let depthDifference = ascentDepth - targetDepth;
            let ascentTime = depthDifference / ascentRate;

            for (let t = 0; t <= ascentTime; t += timeStep) {
                let currentDepth = ascentDepth - (t * ascentRate);
                if (currentDepth < targetDepth) currentDepth = targetDepth;
                let ambientPressure = depthToPressure(currentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: currentDepth });
                currentTime += timeStep;
            }

            ascentDepth = targetDepth;

            // Setrvání na zastávce
            let stopTime = stop.time;
            let stopEndTime = currentTime + stopTime;

            for (; currentTime <= stopEndTime; currentTime += timeStep) {
                let ambientPressure = depthToPressure(ascentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: ascentDepth });
            }
        }

        // Výstup na hladinu
        if (ascentDepth > 0) {
            let ascentTime = ascentDepth / ascentRate;
            for (let t = 0; t <= ascentTime; t += timeStep) {
                let currentDepth = ascentDepth - (t * ascentRate);
                if (currentDepth < 0) currentDepth = 0;
                let ambientPressure = depthToPressure(currentDepth);
                tissues = updateTissues(tissues, ambientPressure, gas.n2Fraction, timeStep);
                data.push({ x: currentTime, y: currentDepth });
                currentTime += timeStep;
            }
        }

        // Poslední bod: hladina
        data.push({ x: currentTime, y: 0 });

        return data;
    }

    // Funkce pro konfiguraci plynu
    function configureGas(gasType) {
        let o2Fraction, n2Fraction;
        switch(gasType) {
            case 'air':
                o2Fraction = 0.21;
                n2Fraction = 0.79;
                break;
            case 'nitrox32':
                o2Fraction = 0.32;
                n2Fraction = 0.68;
                break;
            case 'nitrox36':
                o2Fraction = 0.36;
                n2Fraction = 0.64;
                break;
            default:
                o2Fraction = 0.21;
                n2Fraction = 0.79;
        }
        return { o2Fraction, n2Fraction };
    }

    // Funkce pro aktualizaci parciálních tlaků v tkáních
    function updateTissues(tissues, ambientPressure, n2Fraction, timeStep) {
        let newTissues = [];
        let inspiredN2Pressure = (ambientPressure - 0.0627) * n2Fraction; // 0.0627 bar je tlak vodní páry

        for (let i = 0; i < tissues.length; i++) {
            let halfTime = tissueHalfTimes[i];
            let k = Math.log(2) / halfTime;
            let oldPressure = tissues[i];
            let newPressure = oldPressure + (inspiredN2Pressure - oldPressure) * (1 - Math.exp(-k * timeStep));
            newTissues.push(newPressure);
        }

        return newTissues;
    }

    // Funkce pro výpočet dekompresního plánu
    function calculateDecoPlan(tissues, n2Fraction, gfLow, gfHigh, maxAmbientPressure) {
        let decoPlan = [];
        let ascentDepth = null;
        let lastStopDepth = null;

        // Zaokrouhlení GF na rozsah 0.0 - 1.0
        gfLow = Math.min(Math.max(gfLow, 0.0), 1.0);
        gfHigh = Math.min(Math.max(gfHigh, 0.0), 1.0);

        let stopDepth = Math.floor(pressureToDepth(maxAmbientPressure) / 3) * 3;

        while (stopDepth >= 0) {
            let ambientPressure = depthToPressure(stopDepth);
            let ceilingPressure = calculateCeiling(tissues, gfLow, gfHigh, ambientPressure, maxAmbientPressure);
            let ceilingDepth = pressureToDepth(ceilingPressure);

            if (ceilingDepth > stopDepth) {
                // Potřebujeme zastávku na této hloubce
                let stopTime = 1; // Počáteční čas zastávky v minutách
                let safe = false;

                while (!safe) {
                    // Aktualizace parciálních tlaků v tkáních během zastávky
                    tissues = updateTissues(tissues, ambientPressure, n2Fraction, 1);

                    // Znovu vypočítat strop
                    ceilingPressure = calculateCeiling(tissues, gfLow, gfHigh, ambientPressure, maxAmbientPressure);
                    ceilingDepth = pressureToDepth(ceilingPressure);

                    if (ceilingDepth <= stopDepth) {
                        safe = true;
                    } else {
                        stopTime += 1; // Prodloužit zastávku o 1 minutu
                    }
                }

                decoPlan.push({ depth: stopDepth, time: stopTime });
            }

            stopDepth -= 3; // Další zastávka o 3 metry výše
        }

        return decoPlan;
    }

    // Funkce pro výpočet stropu (ceiling)
    function calculateCeiling(tissues, gfLow, gfHigh, ambientPressure, maxAmbientPressure) {
        let ceilings = [];

        for (let i = 0; i < tissues.length; i++) {
            let a = tissueAValues[i];
            let b = tissueBValues[i];
            let tension = tissues[i];

            // M-hodnota (maximální povolený přetlak)
            let mValue = a * ambientPressure + b;

            // Gradientový faktor (lineární interpolace mezi gfLow a gfHigh)
            let gf = gfLow + (gfHigh - gfLow) * ((ambientPressure - depthToPressure(0)) / (maxAmbientPressure - depthToPressure(0)));

            // Aplikace Gradientového faktoru na M-hodnotu
            let adjustedMValue = gf * mValue;

            // Výpočet stropu
            let ceilingPressure = tension - adjustedMValue;
            ceilings.push(ceilingPressure);
        }

        // Nejvyšší strop (největší tlak)
        return Math.max(...ceilings);
    }

    // Funkce pro převod hloubky na absolutní tlak (bar)
    function depthToPressure(depth) {
        return (depth / 10) + 1; // 1 bar je tlak na hladině
    }

    // Funkce pro převod tlaku na hloubku (m)
    function pressureToDepth(pressure) {
        return (pressure - 1) * 10;
    }

    // Funkce pro vykreslení grafu
    function drawChart(data) {
        console.log("Vykresluji graf s následujícími daty:", data); // Debugging

        let ctx = document.getElementById('diveChart').getContext('2d');

        // Zničení předchozí instance grafu, pokud existuje
        if (window.diveChartInstance) {
            window.diveChartInstance.destroy();
        }

        // Vykreslení nového grafu
        window.diveChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Profil ponoru',
                    data: data,
                    borderColor: '#51a3a3',
                    fill: false,
                    pointRadius: 0,
                    lineTension: 0
                }]
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Čas (min)'
                        },
                        type: 'linear',
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Hloubka (m)'
                        },
                        reverse: true,
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Definice tkáňových poločasů pro ZHL-16C (v minutách)
    const tissueHalfTimes = [4.0, 5.0, 8.0, 12.5, 18.5, 27.0, 38.3, 54.3,
                             77.0, 109.0, 146.0, 187.0, 239.0, 305.0, 390.0, 498.0];

    // Definice hodnot "a" a "b" pro M-hodnoty (ZHL-16C)
    const tissueAValues = [1.2599, 1.0, 0.8618, 0.7562, 0.6667, 0.5933, 0.5282, 0.4701,
                           0.4187, 0.3798, 0.3497, 0.3223, 0.2971, 0.2737, 0.2523, 0.2327];

    const tissueBValues = [0.5050, 0.6514, 0.7222, 0.7825, 0.8125, 0.8434, 0.8693, 0.8910,
                           0.9092, 0.9222, 0.9319, 0.9403, 0.9477, 0.9544, 0.9602, 0.9653];

});

document.getElementById("weightForm").addEventListener("submit", function(event) {
    event.preventDefault();
    
    // Načtení hodnot z formuláře
    let weight = parseFloat(document.getElementById("weight").value);
    let height = parseFloat(document.getElementById("height").value);
    let suit = document.getElementById("suit").value;
    let tank = document.getElementById("tank").value;
    
    // Přibližný objem potápěče (m3)
    let diverVolume = (weight / 1000) * 0.95;  // přibližný vztlak na základě váhy a objemu těla

    // Zohlednění ztráty vztlaku obleku
    let suitBuoyancy;
    switch (suit) {
        case "3mm":
            suitBuoyancy = -2; // přibližná vztlaková hodnota (kg)
            break;
        case "5mm":
            suitBuoyancy = -4;
            break;
        case "7mm":
            suitBuoyancy = -6;
            break;
        case "dry":
            suitBuoyancy = -8;
            break;
    }

    // Zohlednění hmotnosti a vztlaku lahve
    let tankWeight;
    let tankBuoyancy;
    if (tank === "aluminum") {
        tankWeight = 14;  // hmotnost lahve (kg)
        tankBuoyancy = -2; // vztlaková hodnota po použití
    } else if (tank === "steel") {
        tankWeight = 16;
        tankBuoyancy = 0;
    }

    // Základní vztlak potápěče
    let totalBuoyancy = diverVolume + suitBuoyancy + tankBuoyancy;

    // Potřebná zátěž pro mírné přetížení (přidáme cca 1-2 kg pro lepší zanoření)
    let weightNeeded = Math.abs(totalBuoyancy) + 2;

    // Výstup výsledku
    document.getElementById("result").innerText = `Doporučená zátěž: ${weightNeeded.toFixed(2)} kg`;
});


document.querySelectorAll('.course-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        const bubbles = document.createElement('div');
        bubbles.classList.add('bubbles');
        card.appendChild(bubbles);
    });

    card.addEventListener('mouseleave', () => {
        const bubbles = card.querySelector('.bubbles');
        if (bubbles) bubbles.remove();
    });
});

