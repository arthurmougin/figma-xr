#!/bin/bash

# Start the adb server if that's not already the case
adb devices
adb tcpip 5555

# Get the IP address from the first inet line (IPv4), the ip from the connected smartphone
IP_ADDRESS=$(adb shell "ip addr show wlan0 | grep 'inet ' | head -n1 | awk '{print \$2}' | cut -d/ -f1")
echo "IP Address found: $IP_ADDRESS"

# Connect to the device using the extracted IP
adb connect $IP_ADDRESS:5555