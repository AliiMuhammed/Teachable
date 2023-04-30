-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 30, 2023 at 08:25 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lms`
--

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

CREATE TABLE `courses` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `code` varchar(255) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '	0 -> in-active \r\n1 -> active	',
  `image_url` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`id`, `name`, `description`, `code`, `status`, `image_url`) VALUES
(13, 'Graphics12', 'You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near \'?\' at line 1', '145', 1, '1682709149668.png'),
(14, 'Node.js', 'You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near \'?\' at line 1', '52', 1, '1682713102906.jpg'),
(15, 'php', 'You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near \'?\' at line 1', '524', 1, '1682713132482.jpg'),
(16, 'compiler', 'You have an error in your SQL syntax; check the manual that corresponds to your MariaDB server version for the right syntax to use near \'?\' at line 1', '5247', 1, '1682713149720.jpg');

-- --------------------------------------------------------

--
-- Table structure for table `instractors_courses`
--

CREATE TABLE `instractors_courses` (
  `id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `instractor_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `instractors_courses`
--

INSERT INTO `instractors_courses` (`id`, `course_id`, `instractor_id`) VALUES
(2, 13, 11),
(3, 14, 14);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` int(11) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0 -> in-active\r\n1 -> active',
  `type` varchar(255) NOT NULL,
  `image_url` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `phone`, `status`, `type`, `image_url`) VALUES
(11, 'abdo', 'abdelrahman199@gmail.com', '$2b$10$sPXmBYh6Ftm.zZ1PHX.yzOfAKSiO.nCZJm4zf9vvTlAF563kxmcRi', 1210201342, 1, 'instractor', '1682625870406.jpg'),
(14, 'abdohassan', 'abdo1995@gmail.com', '$2b$10$lIHg8x.yFjXBghPo0sOw3epPvt5T5MStqUZeQ0vfMjKz4cEKbAecC', 12345566, 1, 'instractor', '1682631204285.jpg'),
(15, 'abdohas', 'abdo19@gmail.com', '$2b$10$mvaE7uiYF17RL8B6U/Ui9u1VbK3Qow7Vbzj1liYBELKfSynWRq58y', 12345566, 1, 'student', '1682710235122.png'),
(16, 'abdo', 'abdo1@gmail.com', '$2b$10$B5pG2eHH.ezHVYcGH9kO2.rZadO3fNCnJ0S4axPAdKx52DN56ULFu', 12345566, 1, 'student', '1682712987220.jpg'),
(17, 'ali', 'abdo12@gmail.com', '$2b$10$LVft9mdDm4FJ52gV3EibVu/jwxVVo2.TdfZaT3NSGP56TMM0H4tny', 12345566, 1, 'student', '1682713003405.jpg'),
(18, 'azzet', 'abdo124@gmail.com', '$2b$10$MO50en8gBGdagizkz6CX5.mX3X7E7OjA6sDPL5p936S2jV1eFikU2', 12345566, 1, 'student', '1682713021261.jpg'),
(19, 'dina', 'abdo1242@gmail.com', '$2b$10$j3j9cOHj90NotryFWRNGdeNwdDGsosd9i5hmKBUnbpcKh5/i7iGGy', 12345566, 1, 'student', '1682857425332.png');

-- --------------------------------------------------------

--
-- Table structure for table `users_courses`
--

CREATE TABLE `users_courses` (
  `ide` int(11) NOT NULL,
  `student_id` int(11) NOT NULL,
  `course_id` int(11) NOT NULL,
  `grades` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users_courses`
--

INSERT INTO `users_courses` (`ide`, `student_id`, `course_id`, `grades`) VALUES
(1, 18, 15, 75),
(9, 18, 14, 75),
(10, 17, 14, 75),
(11, 16, 14, 0),
(12, 16, 15, 0);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `courses`
--
ALTER TABLE `courses`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `instractors_courses`
--
ALTER TABLE `instractors_courses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `instractor_constr_id` (`instractor_id`),
  ADD KEY `course_constraint_id` (`course_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users_courses`
--
ALTER TABLE `users_courses`
  ADD PRIMARY KEY (`ide`),
  ADD KEY `user_constr_id` (`student_id`),
  ADD KEY `course_constr_id` (`course_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `courses`
--
ALTER TABLE `courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `instractors_courses`
--
ALTER TABLE `instractors_courses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `users_courses`
--
ALTER TABLE `users_courses`
  MODIFY `ide` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `instractors_courses`
--
ALTER TABLE `instractors_courses`
  ADD CONSTRAINT `course_constraint_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `instractor_constr_id` FOREIGN KEY (`instractor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `users_courses`
--
ALTER TABLE `users_courses`
  ADD CONSTRAINT `course_constr_id` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `user_constr_id` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
