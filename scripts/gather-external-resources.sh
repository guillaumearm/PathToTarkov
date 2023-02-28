#!/bin/bash -e

DB_PATH=../../../Aki_Data/Server/database/
TARGET_PATH=external-resources/

mkdir -p $TARGET_PATH
mkdir -p $TARGET_PATH/maps

cp $DB_PATH/locales/global/en.json $TARGET_PATH/locales_global_en.json

cp $DB_PATH/locations/bigmap/base.json $TARGET_PATH/maps/bigmap.json
cp $DB_PATH/locations/factory4_day/base.json $TARGET_PATH/maps/factory4_day.json
cp $DB_PATH/locations/factory4_night/base.json $TARGET_PATH/maps/factory4_night.json
cp $DB_PATH/locations/interchange/base.json $TARGET_PATH/maps/interchange.json
cp $DB_PATH/locations/laboratory/base.json $TARGET_PATH/maps/laboratory.json
cp $DB_PATH/locations/lighthouse/base.json $TARGET_PATH/maps/lighthouse.json
cp $DB_PATH/locations/rezervbase/base.json $TARGET_PATH/maps/rezervbase.json
cp $DB_PATH/locations/shoreline/base.json $TARGET_PATH/maps/shoreline.json
cp $DB_PATH/locations/woods/base.json $TARGET_PATH/maps/woods.json
cp $DB_PATH/locations/tarkovstreets/base.json $TARGET_PATH/maps/tarkovstreets.json

