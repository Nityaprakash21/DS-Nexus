import "dotenv/config";
import connectDB from "../config/db.js";
import Holiday from "../models/Holiday.js";
import { MARKET_HOLIDAYS } from "../constants/marketHolidays.js";

async function checkHolidays() {
    await connectDB();
    const dbHolidays = await Holiday.find().lean();
    console.log(`DB Holidays count: ${dbHolidays.length}`);
    const holidays = dbHolidays.length > 0 ? dbHolidays : MARKET_HOLIDAYS;

    const fyStart = new Date("2026-04-01T00:00:00.000Z");
    const fyEnd = new Date("2027-03-31T23:59:59.999Z");
    const today = new Date(); // or "2026-09-19" / current date

    console.log("Current date:", today.toISOString());

    const fyHolidays = holidays.filter(h => {
        const d = new Date(h.date);
        return d >= fyStart && d <= fyEnd;
    });

    console.log(`Total FY 2026-27 Holidays: ${fyHolidays.length}`);
    for (const h of fyHolidays) {
        const d = new Date(h.date);
        const isPast = d <= today; // or d < today or d <= today
        console.log(`${h.date} (${h.day || ""}) - ${h.name} | isWeekend: ${h.isWeekend} | Passed: ${isPast}`);
    }

    const passedHolidays = fyHolidays.filter(h => new Date(h.date) <= today);
    console.log(`Passed holidays so far: ${passedHolidays.length}`);

    process.exit(0);
}

checkHolidays().catch(console.error);
