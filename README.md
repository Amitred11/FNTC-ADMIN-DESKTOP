# 🐻 Fibear Network Technologies Corp. - Admin Desktop

![Project Status: Educational Capstone](https://img.shields.io/badge/Status-Educational%20Capstone-blueviolet) ![Partner: Fibear Network Technologies Corp.](https://img.shields.io/badge/Partner-Fibear%20Network%20Technologies%20Corp.-orange) ![License: All Rights Reserved](https://img.shields.io/badge/License-All%20Rights%20Reserved-red) ![Version: 4.0.56](https://img.shields.io/badge/Version-1.0.2-informational) ![Made For: Colegio de Montalban](https://img.shields.io/badge/Made%20For-Colegio%20de%20Montalban-blue)

This repository contains the source code for the **FiBear Admin Desktop Panel**, developed as a comprehensive educational capstone project. It provides administrators with a robust interface for managing network services, leveraging modern technologies for a seamless desktop experience.

---

## About

The FiBear Admin Desktop Panel is a crucial tool for managing the FiBear Network. Built with **Electron.js**, it provides a cross-platform desktop application that leverages **React** for the frontend UI. It interacts with a **MongoDB** database to store and retrieve administrative data, ensuring efficient operation and oversight of the network services. The application was developed as a capstone project to demonstrate practical application of full-stack development principles.

---

## Features

The FiBear Admin Desktop Panel offers a suite of features designed for efficient network management:

*   **User & Subscriber Management:** A central hub to view and manage all user and subscriber information.
*   **Service Management:** Oversee and manage various aspects of network services, including job orders and support tickets.
*   **Billing and Payments:** Track financial transactions, manage invoices, and monitor payment statuses.
*   **System Configuration:** Adjust core system settings and manage integration parameters.
*   **Operational Analytics:** Access key performance indicators and data visualizations for network insights.
*   **Communication Tools:** Integrated features for direct communication with users.
*   **Activity Monitoring:** Review logs of administrative actions for auditing and tracking.

---

## Technologies Used

*   **Frontend:** React (with hooks, context API for state management)
*   **Desktop Framework:** Electron.js
*   **UI Library:** [e.g., React Native Paper, Material UI, Ant Design - **Specify your UI library here**]
*   **Backend Communication:** Axios (for interacting with the FiBear API)
*   **Database:** MongoDB
*   **Language:** JavaScript
*   **Build Tools:** [e.g., Webpack, Parcel, Vite - **Specify your build tool**]

---

## Getting Started

### Prerequisites

*   **Node.js:** LTS version recommended. Download from [nodejs.org](https://nodejs.org/).
*   **npm** or **yarn**: Package manager, typically comes bundled with Node.js.
*   **MongoDB:** A running MongoDB instance (local or cloud-based like MongoDB Atlas). Ensure it's accessible.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <project-directory>
    ```

2.  **Install Node.js dependencies:**
    ```bash
    # Using npm
    npm install

    # Or using yarn
    yarn install
    ```

### Running the Application

1.  **Start the Electron development environment:**
    ```bash
    npm start
    # or
    yarn start
    ```
    This command will typically build the application and launch the Electron window for development.

---

## Database Setup (MongoDB)

This application requires a running MongoDB instance to function correctly.

1.  **Local MongoDB:**
    *   Ensure you have MongoDB installed and running on your machine.
    *   The application will attempt to connect using the `MONGODB_URI` configured in your environment variables.

2.  **MongoDB Atlas (Cloud):**
    *   If using MongoDB Atlas, create a cluster and retrieve your connection string.
    *   **Crucially, ensure your application's IP address (or `0.0.0.0/0` for development) is whitelisted in your Atlas network access settings.**

**Connection Configuration:**
Refer to the `Configuration` section for details on how to set the MongoDB connection string via environment variables.

---

## Configuration

Configuration settings are primarily managed through environment variables to ensure flexibility and security.

### Environment Variables

Create a `.env` file in the root directory of the project and add the following variables:

```env
# Example .env file

# Backend API configuration
REACT_APP_API_BASE_URL=http://localhost:3000/api

# MongoDB Connection String
MONGODB_URI=mongodb://localhost:27017/fibear_admin_db
# For MongoDB Atlas:
# MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/<db-name>?retryWrites=true&w=majority

# Internal API Key (if required by your backend for authentication)
CONFIG_INTERNAL_API_KEY=YOUR_INTERNAL_API_KEY

# Add any other necessary configuration variables here
# e.g., SENDGRID_API_KEY=YOUR_SENDGRID_KEY
```

*   `REACT_APP_API_BASE_URL`: The base URL for the FiBear backend API.
*   `MONGODB_URI`: The connection string for your MongoDB database. **This is essential for the application to connect and operate.**
*   `CONFIG_INTERNAL_API_KEY`: An optional API key required for secure backend communication.

---

## Building for Production

To create a production build of the Electron application:

```bash
# Using npm
npm run build

# Or using yarn
yarn build
```

This command will compile your React code, bundle it for Electron, and prepare it for distribution. The output will typically be placed in a `dist` or `build` folder.

---

## Deployment

[Provide instructions on how to package and deploy the Electron application for different operating systems (Windows, macOS, Linux). Mention tools like Electron Forge or Electron Packager if used.]

*   **Windows:** [Instructions for creating an `.exe` installer.]
*   **macOS:** [Instructions for creating a `.dmg` or `.app` bundle.]
*   **Linux:** [Instructions for creating `.deb` or AppImage packages.]

---

## Contributing

Contributions are welcome! This project is an educational capstone, but we encourage improvements and bug fixes.

1.  **Fork the repository** and create a new branch for your feature (`git checkout -b feature/your-feature`).
2.  **Make your changes** and ensure they are well-tested and follow the project's coding standards.
3.  **Commit your changes** using conventional commits if possible.
4.  **Push to your branch** (`git push origin your-feature`) and open a Pull Request.
5.  Ensure your local MongoDB setup is correctly configured as per the `Database Setup` section before running development commands.

---

## 📄 Disclaimer

**This is an educational capstone project and is intended for our Community Partner.**

*   The application is for our Community Partner, Fibear Network Technologies Corp., an Internet Service Provider.
*   All data and functions are solely for the use of our Community Partner.

---

## 🎓 Author

This project was created by **Amitred11** in collaboration with **Fibear Network Technologies Corp.** as the culmination of their studies, showcasing the practical application of software engineering principles.
For UI design and assets, **Jovy Ann Molo** also contributed significantly.

---

## 📜 License and Usage Rights

**© 2024 Amitred11. All Rights Reserved.**

This software and its associated source code are the proprietary property of the author and were developed in partnership with **Fibear Network Technologies Corp.**

**Usage by the Community Partner:**
Our community partner, **Fibear Network Technologies Corp.**, is granted a non-exclusive, perpetual, royalty-free license to use, modify, and deploy this software for their internal operational purposes.

**General Usage Prohibited:**
All other parties are strictly prohibited from copying, distributing, modifying, or using this software for any commercial or non-commercial purpose without the express written permission of the author. This project is **not** open-source.
