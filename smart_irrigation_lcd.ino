/*
  Smart Irrigation - Arduino Uno R4 WiFi + 16x2 LCD
  Reacts to the app's real scheduling/autopilot/weather logic - the Arduino
  does not run its own duplicate logic, it just displays what the app tells
  it is happening.

  App protocol:
    GET /status         -> {"m":..,"t":..,"h":..,"ph":..,"water":..,"pump":0/1,"watering":0/1}
    GET /PUMP_ON         -> relay ON  (manual toggle)
    GET /PUMP_OFF        -> relay OFF
    GET /WATER_ON        -> relay ON  (any watering event - boost/schedule/autopilot)
    GET /WATER_OFF       -> relay OFF

    -- LCD popup tags (call these ALONGSIDE WATER_ON/OFF, don't replace them) --
    GET /BOOST_ON                     -> LCD shows "Instant Boost" popup
    GET /BOOST_OFF
    GET /SCHEDULE_ON?dur=<seconds>    -> LCD shows "Scheduled Water" + countdown
    GET /SCHEDULE_OFF
    GET /AUTOPILOT_ON?dur=<seconds>   -> LCD shows "AI Autopilot" + countdown
    GET /AUTOPILOT_OFF

    -- Rain Skip (call when app cancels a scheduled watering due to rain) --
    GET /RAIN_SKIP_ON                 -> LCD shows "Rain Skip Active" popup
    GET /RAIN_SKIP_OFF

    -- Weather page (call whenever the app refreshes its weather data) --
    GET /WEATHER?temp=<C>&rain=<percent>   -> updates 3rd LCD page

    -- Notification flag (call when a new notification appears/clears) --
    GET /NOTIF_ON                     -> small "N" indicator shown on normal pages
    GET /NOTIF_OFF

  =====================================================
  PIN CONFIG - matches the "Electronics University" video
  =====================================================
*/

#define LCD_RS 7
#define LCD_EN 8
#define LCD_D4 9
#define LCD_D5 10
#define LCD_D6 11
#define LCD_D7 12

#define DHTPIN 5
#define RELAYPIN 6
#define SOILPIN A0

#define RELAY_ACTIVE_LOW true

// =====================================================

#include <WiFiS3.h>
#include <LiquidCrystal.h>
#include <DHT.h>

const char* ssid     = "Dhruv Patel";
const char* password = "Dhruv@2499";

LiquidCrystal lcd(LCD_RS, LCD_EN, LCD_D4, LCD_D5, LCD_D6, LCD_D7);
DHT dht(DHTPIN, DHT11);
WiFiServer server(80);

int dryValue = 550;
int wetValue = 10;

bool pumpState = false;
bool wateringState = false;

float fakePh = 6.5;
unsigned long lastPhChange = 0;
const unsigned long phChangeInterval = 150000;

float waterUsedLiters = 2.4;

// ---- Feature display flags (set by app) ----
enum ActiveFeature { NONE, BOOST, SCHEDULE, AUTOPILOT, RAIN_SKIP };
ActiveFeature currentFeature = NONE;
unsigned long featureEndMillis = 0;
bool featureHasDuration = false;

// ---- Weather data (set by app) ----
float weatherTemp = 0;
int weatherRainChance = 0;
bool weatherReceived = false;

// ---- Notification flag ----
bool hasNotification = false;

void setPump(bool on) {
  pumpState = on;
  wateringState = on;
  bool pinLevel = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(RELAYPIN, pinLevel ? HIGH : LOW);
}

void updateFakePh() {
  if (millis() - lastPhChange > phChangeInterval) {
    lastPhChange = millis();
    float drift = random(-30, 31) / 100.0;
    fakePh += drift;
    if (fakePh < 5.5) fakePh = 5.5;
    if (fakePh > 7.5) fakePh = 7.5;
  }
}

void setup() {
  Serial.begin(9600);
  randomSeed(analogRead(A5));
  pinMode(RELAYPIN, OUTPUT);
  setPump(false);

  lcd.begin(16, 2);
  lcd.print("Connecting WiFi");

  dht.begin();
  connectWiFi();
  server.begin();
}

void connectWiFi() {
  int attempt = 0;
  while (WiFi.localIP() == IPAddress(0, 0, 0, 0)) {
    attempt++;
    Serial.print("Attempt ");
    Serial.print(attempt);
    Serial.print(": connecting to ");
    Serial.println(ssid);

    WiFi.disconnect();
    delay(200);
    WiFi.begin(ssid, password);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
      delay(500);
      Serial.print(".");
    }
    Serial.println();
    Serial.print("WiFi.status() = ");
    Serial.println(WiFi.status());

    if (WiFi.status() == WL_CONNECTED) {
      delay(1000);
      Serial.print("IP received: ");
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Connection attempt failed, retrying...");
    }
  }

  lcd.clear();
  lcd.print("IP:");
  lcd.print(WiFi.localIP());
  Serial.print("Arduino IP: ");
  Serial.println(WiFi.localIP());
  delay(3000);
}

int readMoisturePercent() {
  int raw = analogRead(SOILPIN);
  int pct = map(raw, dryValue, wetValue, 0, 100);
  return constrain(pct, 0, 100);
}

// ---------------- LCD PAGES ----------------

void showNormalPage1(int moisture, float temp, float humidity) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("M:");
  lcd.print(moisture);
  lcd.print("% H:");
  lcd.print(isnan(humidity) ? 0 : (int)humidity);
  lcd.print("%");
  if (hasNotification) {
    lcd.setCursor(15, 0);
    lcd.print("N");
  }

  lcd.setCursor(0, 1);
  lcd.print("T:");
  lcd.print(isnan(temp) ? 0 : temp, 1);
  lcd.print("C");
  lcd.print(pumpState ? " P:ON" : " P:OFF");
}

void showNormalPage2() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("pH: ");
  lcd.print(fakePh, 1);
  if (hasNotification) {
    lcd.setCursor(15, 0);
    lcd.print("N");
  }

  lcd.setCursor(0, 1);
  lcd.print("Water: ");
  lcd.print(waterUsedLiters, 1);
  lcd.print("L");
}

void showNormalPage3() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Weather:");
  if (hasNotification) {
    lcd.setCursor(15, 0);
    lcd.print("N");
  }

  lcd.setCursor(0, 1);
  if (weatherReceived) {
    lcd.print(weatherTemp, 1);
    lcd.print("C Rain:");
    lcd.print(weatherRainChance);
    lcd.print("%");
  } else {
    lcd.print("No data yet");
  }
}

void printCountdown(unsigned long secondsLeft) {
  int m = secondsLeft / 60;
  int s = secondsLeft % 60;
  if (m < 10) lcd.print("0");
  lcd.print(m);
  lcd.print(":");
  if (s < 10) lcd.print("0");
  lcd.print(s);
}

void showFeaturePopup() {
  lcd.clear();
  lcd.setCursor(0, 0);

  if (currentFeature == BOOST) lcd.print("INSTANT BOOST");
  else if (currentFeature == SCHEDULE) lcd.print("SCHEDULED WATER");
  else if (currentFeature == AUTOPILOT) lcd.print("AI AUTOPILOT");
  else if (currentFeature == RAIN_SKIP) lcd.print("RAIN SKIP ACTIVE");

  lcd.setCursor(0, 1);
  if (currentFeature == RAIN_SKIP) {
    lcd.print("Watering held");
  } else if (featureHasDuration) {
    unsigned long secondsLeft = (featureEndMillis > millis()) ? (featureEndMillis - millis()) / 1000 : 0;
    lcd.print("Time left ");
    printCountdown(secondsLeft);
  } else {
    lcd.print("Hydrating...");
  }
}

// ---------------- REQUEST HANDLING ----------------

int extractIntParam(String request, String key) {
  int idx = request.indexOf(key + "=");
  if (idx == -1) return -1;
  idx += key.length() + 1;
  int end = idx;
  while (end < (int)request.length() && (isDigit(request[end]) || request[end] == '.' || request[end] == '-')) {
    end++;
  }
  String valStr = request.substring(idx, end);
  return valStr.toFloat();
}

void loop() {
  WiFiClient client = server.available();
  if (client) {
    String request = client.readStringUntil('\r');
    client.flush();

    int moisture = readMoisturePercent();
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();
    if (isnan(temp)) temp = -1;

    if (request.indexOf("GET /status") >= 0) {
      String json = "{\"m\":" + String(moisture) + ",\"t\":" + String((int)temp) +
                    ",\"h\":" + String(isnan(humidity) ? -1 : (int)humidity) +
                    ",\"ph\":" + String(fakePh, 1) + ",\"water\":" + String(waterUsedLiters, 1) +
                    ",\"pump\":" + String(pumpState ? 1 : 0) +
                    ",\"watering\":" + String(wateringState ? 1 : 0) + "}";
      client.println("HTTP/1.1 200 OK");
      client.println("Content-Type: application/json");
      client.println("Access-Control-Allow-Origin: *");
      client.println("Connection: close");
      client.println();
      client.println(json);
    }
    else if (request.indexOf("GET /PUMP_ON") >= 0) {
      setPump(true);
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nPUMP ON");
    }
    else if (request.indexOf("GET /PUMP_OFF") >= 0) {
      setPump(false);
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nPUMP OFF");
    }
    else if (request.indexOf("GET /WATER_ON") >= 0) {
      setPump(true);
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nWATER ON");
    }
    else if (request.indexOf("GET /WATER_OFF") >= 0) {
      setPump(false);
      if (currentFeature == BOOST || currentFeature == SCHEDULE || currentFeature == AUTOPILOT) {
        currentFeature = NONE;
      }
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nWATER OFF");
    }
    else if (request.indexOf("GET /BOOST_ON") >= 0) {
      currentFeature = BOOST;
      featureHasDuration = false;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nBOOST TAGGED");
    }
    else if (request.indexOf("GET /BOOST_OFF") >= 0) {
      if (currentFeature == BOOST) currentFeature = NONE;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nBOOST UNTAGGED");
    }
    else if (request.indexOf("GET /SCHEDULE_ON") >= 0) {
      currentFeature = SCHEDULE;
      int dur = extractIntParam(request, "dur");
      if (dur > 0) {
        featureHasDuration = true;
        featureEndMillis = millis() + (unsigned long)dur * 1000UL;
      } else {
        featureHasDuration = false;
      }
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nSCHEDULE TAGGED");
    }
    else if (request.indexOf("GET /SCHEDULE_OFF") >= 0) {
      if (currentFeature == SCHEDULE) currentFeature = NONE;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nSCHEDULE UNTAGGED");
    }
    else if (request.indexOf("GET /AUTOPILOT_ON") >= 0) {
      currentFeature = AUTOPILOT;
      int dur = extractIntParam(request, "dur");
      if (dur > 0) {
        featureHasDuration = true;
        featureEndMillis = millis() + (unsigned long)dur * 1000UL;
      } else {
        featureHasDuration = false;
      }
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nAUTOPILOT TAGGED");
    }
    else if (request.indexOf("GET /AUTOPILOT_OFF") >= 0) {
      if (currentFeature == AUTOPILOT) currentFeature = NONE;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nAUTOPILOT UNTAGGED");
    }
    else if (request.indexOf("GET /RAIN_SKIP_ON") >= 0) {
      currentFeature = RAIN_SKIP;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nRAIN SKIP TAGGED");
    }
    else if (request.indexOf("GET /RAIN_SKIP_OFF") >= 0) {
      if (currentFeature == RAIN_SKIP) currentFeature = NONE;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nRAIN SKIP UNTAGGED");
    }
    else if (request.indexOf("GET /WEATHER") >= 0) {
      float t = extractIntParam(request, "temp");
      int r = extractIntParam(request, "rain");
      weatherTemp = t;
      weatherRainChance = r;
      weatherReceived = true;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nWEATHER UPDATED");
    }
    else if (request.indexOf("GET /NOTIF_ON") >= 0) {
      hasNotification = true;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nNOTIF ON");
    }
    else if (request.indexOf("GET /NOTIF_OFF") >= 0) {
      hasNotification = false;
      client.println("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nNOTIF OFF");
    }
    else {
      client.println("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    }
    delay(1);
    client.stop();
  }

  updateFakePh();

  static unsigned long lastTick = 0;
  bool showingPopup = (currentFeature != NONE);
  unsigned long tickInterval = showingPopup ? 1000 : 3000;

  if (millis() - lastTick > tickInterval) {
    lastTick = millis();

    int moisture = readMoisturePercent();
    float temp = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (showingPopup) {
      showFeaturePopup();
    } else {
      static int pageIndex = 0;
      if (pageIndex == 0) showNormalPage1(moisture, temp, humidity);
      else if (pageIndex == 1) showNormalPage2();
      else showNormalPage3();
      pageIndex = (pageIndex + 1) % 3;
    }

    Serial.print("M:");
    Serial.print(moisture);
    Serial.print(" T:");
    Serial.print(isnan(temp) ? -1 : (int)temp);
    Serial.print(" H:");
    Serial.print(isnan(humidity) ? -1 : (int)humidity);
    Serial.print(" Pump:");
    Serial.print(pumpState);
    Serial.print(" Feature:");
    Serial.println(currentFeature);
  }
}
