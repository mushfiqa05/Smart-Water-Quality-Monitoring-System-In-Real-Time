
# Smart IoT-Based University Water Quality Monitoring System

An ESP32-based IoT system developed as a final-year engineering project to monitor water quality parameters and tank levels in university campuses. The system collects sensor readings, sends data to Firebase, and displays the results through a web dashboard.

The hardware prototype was completed and presented to the project jury. The dashboard was deployed using Firebase Hosting.

## Overview

Monitoring water quality and water storage levels is important for university campuses, where tanks supply water to different buildings and facilities. Manual inspection can make continuous monitoring difficult.

This project combines sensor interfacing, embedded programming, cloud connectivity, and web-based visualization to provide a centralized view of water-related measurements.

The system uses an ESP32 to collect and process readings from connected sensors. The readings are uploaded to Firebase Realtime Database over Wi-Fi and displayed through a web dashboard.

## Project Objectives

- Monitor selected water quality parameters in real time.
- Measure water levels using an ultrasonic sensor.
- Upload sensor readings to a cloud database.
- Display monitoring data through a web dashboard.
- Calculate a custom Water Quality Score using threshold-based rules.
- Support historical monitoring and analysis.
- Establish a foundation for future predictive analytics and campus-wide deployment.

## System Architecture

```text
  Water Quality and Level Sensors
                 |
                 v
          ESP32 DevKit V1
      Sensor Reading and Processing
                 |
              Wi-Fi
                 |
                 v
      Firebase Realtime Database
                 |
                 v
        Web Monitoring Dashboard
        HTML / CSS / JavaScript
                 |
                 v
         Water Data Visualization
```

The ESP32 handles sensor acquisition and processing. Firebase Realtime Database stores the uploaded readings, while the web dashboard presents the available data to users.

## Hardware Components

| Component | Purpose |
|---|---|
| ESP32 DevKit V1 | Main microcontroller and Wi-Fi connectivity |
| PH-4502C pH sensor module | Measures pH-related sensor output |
| Gravity TDS sensor | Estimates total dissolved solids |
| Turbidity sensor | Measures water turbidity |
| DS18B20 waterproof sensor | Measures water temperature |
| HC-SR04 ultrasonic sensor | Estimates tank water level |

## Software and Technologies

- **Embedded programming:** C++ and Arduino IDE
- **Microcontroller:** ESP32
- **Frontend:** HTML, CSS and JavaScript
- **Cloud database:** Firebase Realtime Database
- **Web hosting:** Firebase Hosting
- **Communication:** Wi-Fi

## How It Works

1. The sensors collect readings from the water and tank.
2. The ESP32 reads and processes the sensor signals.
3. The readings are uploaded to Firebase Realtime Database over Wi-Fi.
4. The web dashboard retrieves the available data and displays it.
5. A custom rule-based scoring method evaluates selected parameters against configured thresholds.

## Parameters Monitored

| Parameter | Unit | Measurement Method |
|---|---|---|
| pH | pH scale | Analog pH sensor |
| Total dissolved solids (TDS) | ppm | TDS sensor |
| Electrical conductivity (EC) | µS/cm | Estimated from TDS |
| Turbidity | NTU | Turbidity sensor |
| Water temperature | °C | DS18B20 |
| Tank water level | % | Ultrasonic distance measurement |

Electrical conductivity is estimated from TDS readings; a dedicated EC probe is not used in the current prototype.

Sensor calibration and validation against reference instruments are important for improving measurement accuracy.

## Water Quality Score

The project implements a custom Water Quality Score based on configured thresholds for selected parameters, including pH, TDS, turbidity, temperature, conductivity, and tank level.

The score begins at 100, with deductions applied when defined conditions are exceeded. The resulting score is grouped into project-defined status categories.

This is a project-specific rule-based score, not a certified Water Quality Index (WQI). It should not be used on its own to determine whether water is safe to drink. Reliable drinking-water assessment requires appropriate testing and validation against relevant standards.

## Web Dashboard

The dashboard provides a web-based interface for viewing water monitoring data. It was deployed using Firebase Hosting and uses Firebase Realtime Database for cloud data.

The dashboard is built with HTML, CSS, and JavaScript. It provides a web interface for viewing water-monitoring data collected by the ESP32 and stored in Firebase Realtime Database.

**Live Demo:** [Open the Smart Water Monitoring Dashboard]([https://smart-water-monitoring-3a117.web.app/])

## Project Status

The hardware prototype was completed and presented to the project jury. The web dashboard was also deployed.

The project demonstrates sensor-based monitoring, embedded data processing, cloud integration, and web-based visualization.

Machine-learning-based prediction and predictive maintenance are future enhancements, not implemented features of the current system.

## Research Publication

A research paper based on this project was submitted to ICCSDI.

**Publication details provided:**

- **Proceedings:** Proceedings of International Conference on Computational Science and Data Intelligence
- **ISBN:** 978-81-999473-7-5
- **Publisher:** SYBGEN Learning

The exact paper title, author list, page numbers, and publication link should be added after verification against the conference proceedings.

## Limitations

- Sensor readings depend on calibration, sensor condition, and measurement conditions.
- The custom Water Quality Score is not a certified water-quality index.
- Electrical conductivity is estimated from TDS rather than measured using a dedicated EC probe.
- Cloud dashboard updates depend on network availability.
- The current system does not implement machine-learning-based prediction.
- The prototype requires further validation before use in safety-critical water-quality decisions.

## Future Scope

- Improve sensor calibration and measurement accuracy.
- Add offline data buffering and synchronization.
- Expand historical analytics and reporting.
- Evaluate MQTT for alternative IoT communication.
- Explore predictive analytics using validated historical data.
- Investigate automated pump control with suitable safety mechanisms.
- Extend the design to multiple tanks and additional monitoring nodes.
- Evaluate mobile access and industrial-grade sensor integration.

## Applications

- University and campus water-tank monitoring
- Smart campus infrastructure
- Water storage and distribution monitoring
- Water-treatment monitoring
- Residential and industrial water systems

These are potential application areas; deployment beyond the completed prototype would require additional testing and adaptation.

## Repository Structure

```text
Smart-Water-Quality-Monitoring-System-In-Real-Time/
├── firmware/
│   └── ESP32 source files
├── dashboard/
│   ├── index.html
│   ├── style.css
│   ├── script.js
│   └── assets/
├── docs/
│   ├── circuit-diagram/
│   └── system-architecture/
├── images/
│   ├── hardware/
│   └── dashboard/
├── paper/
│   └── publication-details.md
├── .gitignore
└── README.md
```

The structure above is a suggested organization. Folder contents should reflect the actual source files and documentation included in the repository.

## Author

**Mushfiqa Shaikh**

B.Tech Computer Engineering

Interests: IoT, Embedded Systems, Firmware Development and Connected Systems

GitHub: [mushfiqa05](https://github.com/mushfiqa05)
