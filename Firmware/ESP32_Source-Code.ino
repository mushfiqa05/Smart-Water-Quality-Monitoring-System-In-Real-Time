#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include <time.h>

//==================== VARIABLES ====================
float temperature;
float tdsValue;
float ecValue;
float turbidityNTU;
float pHValue;
float distanceCM;
float waterLevel = 0;

//==================== WIFI ====================
#define WIFI_SSID "iPhone 17"
#define WIFI_PASSWORD "Nikhil@2126"

//==================== NTP ====================
const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 19800; // UTC +5:30
const int   daylightOffset_sec = 0;

//==================== FIREBASE ====================
#define API_KEY "AIzaSyCnc_ho8WHyFG7T0PBV2xoocfBi6SRwtOo"
#define DATABASE_URL "https://smart-water-monitoring-3a117-default-rtdb.asia-southeast1.firebasedatabase.app/WaterMonitoring/Settings"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

//==================== PINS ====================
#define TDS_PIN         32
#define TURBIDITY_PIN   35
#define PH_PIN          34
#define ONE_WIRE_BUS    27
#define TRIG_PIN        25
#define ECHO_PIN        26
#define TANK_HEIGHT 100.0

//==================== OBJECTS ====================
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
unsigned long lastSensorRead = 0;

unsigned long lastLiveUpload = 0;

unsigned long lastHistoryUpload = 0;

//==================== ALERT STATUS MEMORY ====================
bool lastTDSAlert = false;
bool lastPHLowAlert = false;
bool lastPHHighAlert = false;
bool lastTurbidityAlert = false;
bool lastWaterLevelAlert = false;

void connectWiFi()
{
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000)
  {
    Serial.print(".");
    delay(500);
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    Serial.print("WiFi FAILED. Status code: ");
    Serial.println(WiFi.status());
  }
}

void syncTime()
{
  Serial.print("Syncing time with NTP");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nTime synced successfully");
}

String getISO8601Time() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    return "";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%d_%H-%M-%S", &timeinfo);
  return String(timeStringBuff);
}

String getYearMonth() {
  struct tm timeinfo;
  if(!getLocalTime(&timeinfo)){
    return "";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%Y/%m", &timeinfo);
  return String(timeStringBuff);
}

void initFirebase()
{
    config.api_key = API_KEY;
    config.database_url = DATABASE_URL;

    // Anonymous sign in or simple email/password if setup
    auth.user.email = "esp32@test.com";
    auth.user.password = "12345678";

    config.token_status_callback = tokenStatusCallback;

    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);

    Serial.print("Waiting for Firebase");
    while (auth.token.uid == "")
    {
        Serial.print(".");
        delay(500);
    }
    Serial.println("\nFirebase Connected");
}

float averageAnalog(int pin, int samples)
{
  long total = 0;
  for (int i = 0; i < samples; i++)
  {
    total += analogRead(pin);
    delay(5);
  }
  return total / (float)samples;
}

float readDistance()
{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}
String getHistoryPath()
{
    struct tm timeinfo;

    getLocalTime(&timeinfo);

    char buffer[30];

    strftime(buffer,sizeof(buffer),
             "%Y/%m/%d",
             &timeinfo);

    return String(buffer);
}


int calculateWaterQualityScore()
{
    int score = 100;

    if (pHValue < 6.5 || pHValue > 8.5)
        score -= 20;

    if (tdsValue > 500)
        score -= 20;

    if (turbidityNTU > 5)
        score -= 20;

    if (temperature > 35)
        score -= 10;

    if (ecValue > 1.5)
        score -= 10;

    if (waterLevel < 20)
        score -= 20;

    if(score < 0)
        score = 0;

    return score;
}

String getTankStatus()
{
    int score = calculateWaterQualityScore();

    if(score >= 80)
        return "Safe";

    if(score >= 50)
        return "Moderate";

    return "Unsafe";
}  

void uploadAlert(String parameter,
                 float value,
                 float threshold,
                 String severity,
                 bool active)
{
    FirebaseJson alert;

    alert.set("Parameter", parameter);
    alert.set("Value", value);
    alert.set("Threshold", threshold);
    alert.set("Severity", severity);
    alert.set("Timestamp", getISO8601Time());

    if(active)
        alert.set("Status","Active");
    else
        alert.set("Status","Cleared");

    Firebase.RTDB.setJSON(
        &fbdo,
        ("/WaterMonitoring/Tank1/Alerts/" + parameter).c_str(),
        &alert
    );
}

void evaluateAlerts()
{
    bool currentTDS = (tdsValue > 500);

    if(currentTDS != lastTDSAlert)
    {
        uploadAlert("TDS", tdsValue, 500, "High", currentTDS);
        lastTDSAlert = currentTDS;
    }

    bool currentPHLow = (pHValue < 6.5);

    if(currentPHLow != lastPHLowAlert)
    {
        uploadAlert("pH_Low", pHValue, 6.5, "Low", currentPHLow);
        lastPHLowAlert = currentPHLow;
    }

    bool currentPHHigh = (pHValue > 8.5);

    if(currentPHHigh != lastPHHighAlert)
    {
        uploadAlert("pH_High", pHValue, 8.5, "High", currentPHHigh);
        lastPHHighAlert = currentPHHigh;
    }

    bool currentTurbidity = (turbidityNTU > 5);

    if(currentTurbidity != lastTurbidityAlert)
    {
        uploadAlert("Turbidity", turbidityNTU, 5, "High", currentTurbidity);
        lastTurbidityAlert = currentTurbidity;
    }

    bool currentWaterLevel = (waterLevel < 20);

    if(currentWaterLevel != lastWaterLevelAlert)
    {
        uploadAlert("WaterLevel", waterLevel, 20, "Low", currentWaterLevel);
        lastWaterLevelAlert = currentWaterLevel;
    }
}

void uploadToFirebase()
{
    if (!Firebase.ready()) return;

    String timestamp = getISO8601Time();
    if (timestamp == "") return; // Time not yet synced

    FirebaseJson json;
    int score = calculateWaterQualityScore();

json.set("Temperature", temperature);
json.set("TDS", tdsValue);
json.set("EC", ecValue);
json.set("Turbidity", turbidityNTU);
json.set("pH", pHValue);
json.set("WaterLevel", waterLevel);

json.set("WaterQualityScore", score);
json.set("TankStatus", getTankStatus());

json.set("Timestamp", timestamp);
json.set("LastUpdated", timestamp);

    // 1. Upload to Live node (happens every 5s)
    if (Firebase.RTDB.setJSON(&fbdo, "/WaterMonitoring/Tank1/Live", &json)) {
        Serial.println("Firebase Live node updated.");
        evaluateAlerts();
    } else {
        Serial.println("Failed to update Live node: " + fbdo.errorReason());
    }
    FirebaseJson analytics;

analytics.set("Temperature", temperature);
analytics.set("TDS", tdsValue);
analytics.set("EC", ecValue);
analytics.set("pH", pHValue);
analytics.set("Turbidity", turbidityNTU);
analytics.set("WaterLevel", waterLevel);
analytics.set("WaterQualityScore", score);
analytics.set("TankStatus", getTankStatus());
analytics.set("LastUpdated", timestamp);

Firebase.RTDB.setJSON(
    &fbdo,
    "/WaterMonitoring/Tank1/Analytics",
    &analytics
);

    // 2. Upload to History node (throttled to once per minute)
    if (millis() - lastHistoryUpload >= 60000 || lastHistoryUpload == 0) {
        String path =
        "/WaterMonitoring/Tank1/History/"
        + getHistoryPath()
        + "/"
        + timestamp;
        
        if (Firebase.RTDB.setJSON(&fbdo, path.c_str(), &json)) {
            Serial.println("Firebase History node appended.");
            lastHistoryUpload = millis();
        } else {
            Serial.println("Failed to update History node: " + fbdo.errorReason());
        }
    }
}

void setup()
{
  Serial.begin(115200);
  analogReadResolution(12);
  sensors.begin();
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  connectWiFi();
  syncTime();
  initFirebase();

  Serial.println("\n==========================================");
  Serial.println(" SMART WATER QUALITY TESTING ");
  Serial.println("==========================================");
}

void loop()
{

  
if (WiFi.status() != WL_CONNECTED)
{
    connectWiFi();
}

  if(millis()-lastSensorRead>=2000)
{
    lastSensorRead=millis();

    // ALL sensor readings go here

  //---------------- TEMPERATURE ----------------
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);

  //---------------- TDS ----------------
  float rawTDS = averageAnalog(TDS_PIN, 20);
  float tdsVoltage = rawTDS * 3.3 / 4095.0;
  float compensationVoltage = tdsVoltage;

  if (temperature != DEVICE_DISCONNECTED_C) {
      float compensationCoefficient = 1.0 + 0.02 * (temperature - 25);
      compensationVoltage = tdsVoltage / compensationCoefficient;
  }

  tdsValue = (133.42 * pow(compensationVoltage, 3) - 255.86 * pow(compensationVoltage, 2) + 857.39 * compensationVoltage) * 0.5;
  if (tdsValue < 0) tdsValue = 0;
  ecValue = tdsValue / 500.0;

  //---------------- TURBIDITY ----------------
  float rawTurb = averageAnalog(TURBIDITY_PIN, 20);
  float turbVoltage = rawTurb * 3.3 / 4095.0;
  turbidityNTU = -1120.4 * pow(turbVoltage, 2) + 5742.3 * turbVoltage - 4352.9;
  if (turbidityNTU < 0) turbidityNTU = 0;

  //---------------- pH ----------------
  float rawPH = averageAnalog(PH_PIN, 20);
  float phVoltage = rawPH * 3.3 / 4095.0;
  pHValue = 3.5 * phVoltage; // Approximate conversion
  if (pHValue < 0) pHValue = 0;
  if (pHValue > 14) pHValue = 14;

  //---------------- WATER LEVEL ----------------
  distanceCM = readDistance();
  waterLevel = 0;
  if (distanceCM != -1) {
      waterLevel = ((TANK_HEIGHT - distanceCM) / TANK_HEIGHT) * 100.0;
      if (waterLevel < 0) waterLevel = 0;
      if (waterLevel > 100) waterLevel = 100;
  }

if(millis()-lastLiveUpload>=5000)
{
    lastLiveUpload=millis();

    uploadToFirebase();
}

  //---------------- OUTPUT ----------------
  Serial.println("==========================================");
  Serial.print("Temperature : ");
  if (temperature == DEVICE_DISCONNECTED_C) Serial.println("Sensor Not Connected");
  else { Serial.print(temperature, 2); Serial.println(" °C"); }
  
  Serial.print("TDS         : "); Serial.print(tdsValue, 0); Serial.println(" ppm");
  Serial.print("EC          : "); Serial.print(ecValue, 2); Serial.println(" mS/cm");
  Serial.print("Turbidity   : "); Serial.print(turbidityNTU, 2); Serial.println(" NTU");
  Serial.print("pH          : "); Serial.println(pHValue, 2);
  
  Serial.print("Distance    : ");
  if (distanceCM == -1) Serial.println("Sensor Not Detected");
  else { Serial.print(distanceCM, 2); Serial.println(" cm"); }
  Serial.println("==========================================");
  
}

}