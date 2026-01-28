module.exports = {
    server: {
        baseDir: "./",
        index: "index.html"
    },
    port: 8000,
    open: "/pages/login.html",
    notify: false,
    // Chỉ watch các file cần thiết
    files: [
        "**/*.html",
        "**/*.js",
        "**/*.css",
        // Loại trừ các thư mục và file không cần watch
        "!backend/uploads/**",
        "!backend/target/**",
        "!**/*.jpg",
        "!**/*.jpeg",
        "!**/*.png",
        "!**/*.gif",
        "!**/*.mp4",
        "!**/*.mov",
        "!**/*.avi",
        "!**/*.webm",
        "!node_modules/**",
        "!.git/**"
    ],
    // Cấu hình watch options với chokidar
    watchOptions: {
        ignored: [
            // Ignore patterns sử dụng glob hoặc regex
            "**/backend/uploads/**",
            "**/backend/target/**",
            "**/*.jpg",
            "**/*.jpeg",
            "**/*.png",
            "**/*.gif",
            "**/*.mp4",
            "**/*.mov",
            "**/*.avi",
            "**/*.webm",
            "**/node_modules/**",
            "**/.git/**"
        ],
        // Sử dụng chokidar với ignoreInitial để không trigger reload khi khởi động
        ignoreInitial: true,
        // Persistent watch
        persistent: true
    },
    // Tắt auto-reload cho các file trong uploads
    reloadOnRestart: true
};

