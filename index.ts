import papaparse from 'papaparse';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';
dotenv.config();

export interface CityLocation {
    city: string,
    state: string,
    latitude: number,
    longitude: number,
}

interface CityWeather extends CityLocation {
    hourlyWeather: HourlyWeather[];
}

interface HourlyWeather {
    dt: number,
    temp: number,
}

/**
 * Parse 
 * 
 * @param csv Csv data as a string
 * @returns Parsed CSV data in an array
 */
function parseCsv<T>(csv: string): T[]{
    const csvParsed = papaparse.parse<T>(csv, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
    });

    return csvParsed.data;
}

export async function getCityWeather(lat: number, lon: number): Promise<any>{
    if (lat > 90 || lat < -90 || lon > 180 || lon < -180){
        throw new Error(`Invalid lat/lon values: lat=${lat}, lon=${lon}`);
    }

    try{
        const result = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
            params:{
                lat: lat, 
                lon: lon,
                exclude: 'current,minutely,daily,alerts',
                appid: process.env.WEATHER_API_KEY,
                units: 'imperial',
            }
        });

        return result.data;
    } catch(err){
        if (axios.isAxiosError(err)){
            console.error(err?.response?.data ?? err.message);
        } else{
            throw new Error('Something went wrong');
        }

    }
}

/**
 * Given an array of numbers, finds the lowest average across k consecutive elements
 * 
 * @param k The number of consecutive values to average
 * @param nums Array of numbers
 * @returns 
 */
export function findConsecutiveMinimumAvg(k: number, nums: number[]): number {
    // [-10, 20, 50, -30, 25, 25, -5]
    let min: number = 0;
    for (let i = 0; i < k; i++){
        min += nums[i];
    }

    let currentSum = min;
    for (let i = k; i < nums.length; i++){
        currentSum = currentSum - nums[i - k] + nums[i];
        min = Math.min(min, currentSum);
    }

    return min/k;
}


async function main(){
    try{
        const csv = fs.readFileSync('./cities.csv', 'utf-8');

        const cityLocations = parseCsv<CityLocation>(csv);

        // Grab all city's weather at once
        const weatherPromises = cityLocations.map(async (location):Promise<CityWeather> => {
            const weather = await getCityWeather(location.latitude, location.longitude);
            return {
                ...location, 
                hourlyWeather: weather.hourly.map((hour: any) => {
                    return {
                        dt: hour.dt,
                        temp: hour.temp,
                    }
                })
            }
        });
        const weatherResults = await Promise.all(weatherPromises); // Wait for API calls to finish

        const citiesLowestThreeHourAvg: Array<{city: string, avg: number}> = [];
        for (let i = 0; i < weatherResults.length; i++){
            const cityData = weatherResults[i];
            const temperatureArray = cityData.hourlyWeather.map((hour)=> (hour.temp));
            const lowestThreeHourAvg = findConsecutiveMinimumAvg(3, temperatureArray);
            citiesLowestThreeHourAvg.push({city: cityData.city, avg: lowestThreeHourAvg});
        }

        citiesLowestThreeHourAvg.forEach((cityAvg)=>{
            console.log(cityAvg);
        });


    } catch(err){
        console.error(err);
    }
}

export default main;
