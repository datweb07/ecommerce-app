
<h1 align="center">E-Commerce App (Mobile + Admin + Backend (API))</h1>

This repository contains a full-stack e-commerce application with three main parts:

- Mobile app (client) — cross-platform mobile application for shoppers
- Admin dashboard — web application for store administrators to manage products, orders, and reviews
- Backend (API) — Node.js/Express API that powers both frontends

The sections below introduce the project, list main features, describe the technology stack, and provide detailed instructions to run each part locally.

## Introduction

This E-Commerce App is a reference implementation for a modern online store. It demonstrates how to structure a mono-repo containing multiple applications (mobile, admin, backend) that share a single backend API for authentication, product management, orders, and reviews.

## Features (Functionality)

- User registration and login
- Product listing, search, and details
- Cart management and checkout flow
- Order history and basic order management
- Product reviews and ratings
- Admin interfaces for product & order management
- Image uploads (Cloudinary or similar)
- Role-based access control (user vs. admin)

## Tech Stack

- Backend: Node.js + Express, MongoDB
- Admin frontend: React + Vite 
- Mobile frontend: React Native 
- Image storage: Cloudinary
- Authentication: Clerk

## Repository layout

- backend — API server and backend code
- admin — admin web app
- mobile — mobile application

## Contributing

- Open issues for bugs/feature requests. Fork, create a branch, and open a pull request for code changes.
