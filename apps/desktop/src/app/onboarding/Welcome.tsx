import { motion } from "framer-motion";

export function Welcome() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="max-w-xl text-center px-6"
    >
      <div className="text-6xl mb-6" aria-hidden>
        ✨
      </div>
      <h1 className="text-3xl font-bold text-ink mb-3">
        안녕하세요. 컴퓨터 상태부터 봐드릴게요.
      </h1>
      <p className="text-subtle mb-8">
        걱정 마세요. 부족한 건 제가 다 깔아드릴게요.
      </p>
      <button
        type="button"
        className="px-6 py-3 rounded-xl bg-primary text-white font-medium shadow-sm hover:opacity-90 transition"
      >
        시작할게요
      </button>
      <p className="mt-6 text-xs text-subtle">v0.1 · TG (Terminal Guardian)</p>
    </motion.section>
  );
}
