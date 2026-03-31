"use client";

import { motion } from "framer-motion";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

function ElegantShape({
    className,
    delay = 0,
    width = 400,
    height = 100,
    rotate = 0,
    gradient = "from-white/[0.08]",
}: {
    className?: string;
    delay?: number;
    width?: number;
    height?: number;
    rotate?: number;
    gradient?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -150, rotate: rotate - 15 }}
            animate={{ opacity: 1, y: 0, rotate: rotate }}
            transition={{ duration: 2.4, delay, ease: [0.23, 0.86, 0.39, 0.96], opacity: { duration: 1.2 } }}
            className={cn("absolute", className)}
        >
            <motion.div
                animate={{ y: [0, 15, 0] }}
                transition={{ duration: 12, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
                style={{ width, height }}
                className="relative"
            >
                <div
                    className={cn(
                        "absolute inset-0 rounded-full",
                        "bg-gradient-to-r to-transparent",
                        gradient,
                        "backdrop-blur-[2px] border-2 border-white/[0.15]",
                        "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
                        "after:absolute after:inset-0 after:rounded-full",
                        "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]"
                    )}
                />
            </motion.div>
        </motion.div>
    );
}

function HeroGeometric({
    badge = "LyftTrack Elite",
    title1 = "Eleva o teu treino",
    title2 = "Domina a tua evolução",
}: {
    badge?: string;
    title1?: string;
    title2?: string;
}) {
    const fadeUpVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { duration: 1, delay: 0.5 + i * 0.2, ease: [0.25, 0.4, 0.25, 1] },
        }),
    };

    return (
        <div className="relative h-[150vh] w-full bg-[#030303]">
            <div className="sticky top-0 left-0 h-screen w-full flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.05] via-transparent to-cyan-500/[0.05] blur-3xl" />

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <ElegantShape delay={0.3} width={600} height={140} rotate={12} gradient="from-blue-500/[0.15]" className="left-[-10%] md:left-[-5%] top-[15%] md:top-[20%]" />
                <ElegantShape delay={0.5} width={500} height={120} rotate={-15} gradient="from-cyan-500/[0.15]" className="right-[-5%] md:right-[0%] top-[70%] md:top-[75%]" />
                <ElegantShape delay={0.4} width={300} height={80} rotate={-8} gradient="from-sky-500/[0.15]" className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]" />
                <ElegantShape delay={0.6} width={200} height={60} rotate={20} gradient="from-indigo-500/[0.15]" className="right-[15%] md:right-[20%] top-[10%] md:top-[15%]" />
                <ElegantShape delay={0.7} width={150} height={40} rotate={-25} gradient="from-blue-400/[0.15]" className="left-[20%] md:left-[25%] top-[5%] md:top-[10%]" />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6 pointer-events-none">
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-[#030303]/80 pointer-events-none" />
            </div>
        </div>
    );
}

export { HeroGeometric }
