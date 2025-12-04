-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: ipes1_prueba
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `core_profesorado`
--

DROP TABLE IF EXISTS `core_profesorado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `core_profesorado` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `duracion_anios` int NOT NULL,
  `activo` tinyint(1) NOT NULL,
  `inscripcion_abierta` tinyint(1) NOT NULL,
  `es_certificacion_docente` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `core_profesorado`
--

LOCK TABLES `core_profesorado` WRITE;
/*!40000 ALTER TABLE `core_profesorado` DISABLE KEYS */;
INSERT INTO `core_profesorado` VALUES (1,'Profesorado de Educación Primaria',4,1,1,0),(2,'Profesorado de Educación Inicial',4,1,1,0),(3,'Profesorado de Educación  Secundaria en Geografía',4,1,1,0),(4,'Certificación Docente para la Educación Secundaria',2,1,1,1);
/*!40000 ALTER TABLE `core_profesorado` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `core_plandeestudio`
--

DROP TABLE IF EXISTS `core_plandeestudio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `core_plandeestudio` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `resolucion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `anio_inicio` int NOT NULL,
  `anio_fin` int DEFAULT NULL,
  `vigente` tinyint(1) NOT NULL,
  `profesorado_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `resolucion` (`resolucion`),
  KEY `core_plandeestudio_profesorado_id_a23fc44d_fk` (`profesorado_id`),
  CONSTRAINT `core_plandeestudio_profesorado_id_a23fc44d_fk` FOREIGN KEY (`profesorado_id`) REFERENCES `core_profesorado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `core_plandeestudio`
--

LOCK TABLES `core_plandeestudio` WRITE;
/*!40000 ALTER TABLE `core_plandeestudio` DISABLE KEYS */;
INSERT INTO `core_plandeestudio` VALUES (1,'1935/2014',2015,NULL,1,1),(2,'1933/14',2015,NULL,1,2),(3,'3154/21',2022,NULL,1,4);
/*!40000 ALTER TABLE `core_plandeestudio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `core_materia`
--

DROP TABLE IF EXISTS `core_materia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `core_materia` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `anio_cursada` int NOT NULL,
  `formato` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `plan_de_estudio_id` bigint NOT NULL,
  `horas_semana` int NOT NULL,
  `regimen` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_formacion` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `core_materia_plan_de_estudio_id_anio__5fca45e4_uniq` (`plan_de_estudio_id`,`anio_cursada`,`nombre`),
  CONSTRAINT `core_materia_plan_de_estudio_id_da282ef5_fk_core_plan` FOREIGN KEY (`plan_de_estudio_id`) REFERENCES `core_plandeestudio` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `core_materia`
--

LOCK TABLES `core_materia` WRITE;
/*!40000 ALTER TABLE `core_materia` DISABLE KEYS */;
INSERT INTO `core_materia` VALUES (1,'Pedagogía',1,'ASI',1,3,'ANU','FGN'),(2,'Práctica I: Instituciones educativas y comunidad',1,'PRA',1,3,'ANU','PDC'),(3,'Matemática',1,'ASI',1,5,'ANU','FES'),(4,'Ciencias Naturales',1,'ASI',1,4,'ANU','FES'),(5,'Prácticas del Lenguaje',1,'ASI',1,4,'ANU','FES'),(6,'Historia Social Argentina y Latinoamericana',1,'ASI',1,4,'PCU','FGN'),(7,'Alfabetización Académica',1,'TAL',1,4,'PCU','FGN'),(8,'Cuerpo, juego y expresión',1,'TAL',1,3,'PCU','FGN'),(9,'Psicología Educacional',1,'ASI',1,4,'SCU','FGN'),(10,'Educación Sexual Integral',1,'TAL',1,3,'SCU','FGN'),(11,'Práctica II: Enseñanza y curriculum',2,'PRA',1,4,'ANU','PDC'),(12,'Didáctica General',2,'ASI',1,4,'ANU','FGN'),(13,'Ciencias Sociales',2,'ASI',1,4,'ANU','FES'),(14,'Problemática de la educación primaria',2,'MOD',1,4,'ANU','FES'),(15,'Didáctica de la matemática',2,'MOD',1,4,'ANU','FES'),(16,'Didáctica de las ciencias naturales',2,'MOD',1,4,'ANU','FES'),(17,'Sujeto de la Educación Primaria I',2,'MOD',1,4,'ANU','FES'),(18,'Curriculum',2,'MOD',1,4,'PCU','FGN'),(19,'Historia y política educacional',2,'ASI',1,4,'SCU','FGN'),(20,'Práctica III: Práctica de la enseñanza',3,'PRA',1,6,'ANU','PDC'),(21,'Lenguajes artísticos',3,'TAL',1,3,'ANU','FES'),(22,'Alfabetización Inicial',3,'MOD',1,4,'ANU','FES'),(23,'Didáctica de las Ciencias Sociales',3,'MOD',1,4,'ANU','FES'),(24,'Didáctica de las prácticas del lenguaje',3,'MOD',1,4,'ANU','FES'),(25,'Filosofía de la Educación',3,'ASI',1,4,'PCU','FGN'),(26,'Formación Ética y Ciudadana',3,'MOD',1,4,'PCU','FGN'),(27,'Sujeto de la Educación Primaria II',3,'MOD',1,4,'PCU','FES'),(28,'Sociología de la Educación',3,'ASI',1,4,'SCU','FGN'),(29,'Educación Física',3,'TAL',1,3,'ANU','FES'),(30,'Práctica IV: Residencia pedagógica',4,'PRA',1,10,'ANU','PDC'),(31,'Investigación Educativa',4,'TAL',1,3,'ANU','FGN'),(32,'Taller de Residencia de Matemática',4,'TAL',1,4,'ANU','FES'),(33,'Taller de Residencia de Prácticas del Lenguaje',4,'TAL',1,4,'ANU','FES'),(34,'Taller de Residencia de Ciencias Naturales',4,'TAL',1,4,'ANU','FES'),(35,'Taller de Residencia de Ciencias Sociales',4,'TAL',1,4,'ANU','FES'),(36,'Proyectos Educativos con TIC',4,'TAL',1,3,'PCU','FGN'),(37,'EDI: Regionalización: Conociendo la Provincia',1,'TAL',1,3,'PCU','FGN'),(38,'EDI: Actos Escolares Como Prácticas Pedagógicas',3,'TAL',1,3,'SCU','FGN'),(39,'EDI: Literatura Infanto Juvenil',4,'TAL',1,3,'SCU','FGN'),(40,'EDI: Los Desafíos de la Formación Docente en Clave de Educación Inclusiva',4,'TAL',1,3,'SCU','FGN'),(41,'Pedagogía',1,'ASI',2,3,'ANU','FGN'),(42,'Práctica I: Instituciones educativas y comunidad',1,'PRA',2,3,'ANU','FES'),(43,'Lenguaje Visual y su enseñanza',1,'TAL',2,4,'ANU','FES'),(44,'Sujetos de la educación inicial',1,'MOD',2,4,'ANU','FES'),(45,'Problemática contemporánea de la Educación Inicial',1,'MOD',2,3,'ANU','FES'),(46,'Prácticas del Lenguaje',1,'ASI',2,4,'ANU','FES'),(47,'Historia social argentina y latinoamericana',1,'ASI',2,4,'ANU','FGN'),(48,'Cuerpo, juego y expresión',1,'TAL',2,3,'PCU','FES'),(49,'Psicología educacional',1,'ASI',2,4,'SCU','FGN'),(50,'Lenguaje musical y su enseñanza',1,'TAL',2,4,'SCU','FGN'),(51,'EDI: Lenguaje Teatral como herramienta Pedagogica',1,'TAL',2,3,'SCU','FGN'),(52,'Práctica II: Enseñanza y curriculum',2,'PRA',2,4,'ANU','PDC'),(53,'Didáctica general',2,'ASI',2,4,'ANU','FGN'),(54,'Ciencias Naturales',2,'ASI',2,4,'ANU','FES'),(55,'Didáctica de la Educación Inicial I',2,'ASI',2,3,'ANU','FES'),(56,'Ciencias Sociales',2,'ASI',2,3,'ANU','FES'),(57,'Alfabetización Inicial',2,'TAL',2,3,'ANU','FES'),(58,'Curriculum',2,'MOD',2,4,'PCU','FGN'),(59,'La institución Jardín Maternal',2,'SEM',2,3,'PCU','FES'),(60,'Lenguaje corporal y su enseñanza',2,'TAL',2,4,'PCU','FES'),(61,'Historia y Política Educacional',2,'ASI',2,4,'SCU','FGN'),(62,'Matemática',2,'ASI',2,6,'SCU','FES'),(63,'Literatura infantil',2,'ASI',2,3,'SCU','FES'),(64,'Práctica III: Práctica de la Enseñanza',3,'PRA',2,6,'ANU','PDC'),(65,'Didáctica de la Educación inicial II',3,'ASI',2,3,'ANU','FES'),(66,'Didáctica de las Prácticas del Lenguaje',3,'MOD',2,3,'ANU','FES'),(67,'Didáctica de la Matemática',3,'MOD',2,3,'ANU','FES'),(68,'Didáctica de las Ciencias Naturales',3,'MOD',2,3,'ANU','FES'),(69,'Didáctica de las Ciencias Sociales',3,'MOD',2,3,'ANU','FES'),(70,'Filosofía de la Educación',3,'ASI',2,4,'PCU','FGN'),(71,'Producción de materiales y objetos lúdicos',3,'TAL',2,3,'PCU','FES'),(72,'Educación sexual integral',3,'TAL',2,3,'PCU','FES'),(73,'Sociología de la Educación',3,'ASI',2,4,'SCU','FGN'),(74,'Formación Ética y Ciudadana',3,'ASI',2,4,'SCU','FGN'),(75,'EDI: Actos Escolares como Prácticas Pedagógicas',3,'TAL',2,3,'SCU','FGN'),(76,'Practica IV: Residencia Pedagógica',4,'PRA',2,12,'ANU','PDC'),(77,'Taller Integrador Interdisciplinario',4,'TAL',2,5,'ANU','FES'),(78,'Investigacion Educativa ',4,'TAL',2,3,'ANU','FES'),(79,'Proyectos Educativos con TIC',1,'TAL',2,3,'PCU','FES'),(80,'Educación Física y su Enseñanza',4,'ASI',2,4,'SCU','FES'),(81,'EDI:',4,'TAL',2,3,'PCU','FES'),(83,'EDI: Normativa y Legislación',4,'TAL',2,3,'SCU','FES'),(84,'Problemática de la Educación Secundaria  (Semipresencial)',1,'SEM',3,3,'ANU','FGN'),(85,'Sujeto de la Educación Secundaria 1 (Presencial)',1,'MOD',3,3,'ANU','FGN'),(86,'Pedagogía (Semipresencial)',1,'ASI',3,3,'ANU','FGN'),(87,'Didáctica General (Presencial)',1,'ASI',3,3,'ANU','FGN'),(88,'Práctica Profesional I (Presencial)',1,'PRA',3,6,'ANU','PDC'),(89,'Marco Político Normativo en Educación Secundaria  (Semipresencial)',1,'SEM',3,3,'SCU','FGN'),(90,'Curriculum (Semipresencial)',1,'MOD',3,4,'SCU','FGN'),(91,'Historia Social Argentina y Latinoamericana  (Semipresencial)',1,'ASI',3,3,'PCU','FGN'),(92,'Psicología Educacional (Semi presencial)',1,'MOD',3,4,'PCU','FGN'),(93,'EDI Políticas de Inclusión en Educación  (semipresencial)',1,'TAL',3,3,'PCU','FGN'),(94,'Sujeto de la Educación Secundaria II (Presencial)',2,'MOD',3,3,'ANU','FGN'),(95,'Didáctica del Nivel Secundario (Presencial)',2,'ASI',3,4,'ANU','FGN'),(96,'Práctica Profesional II (Presencial)',2,'PRA',3,6,'ANU','PDC'),(97,'Alfabetización Digital (Semipresencial)',2,'TAL',3,3,'PCU','FGN'),(98,'Filosofía de la Educación (Semipresencial)',2,'MOD',3,3,'PCU','FGN'),(99,'Proceso de Evaluación de la Ed. Secundaria  (Semipresencial)',2,'SEM',3,3,'SCU','FGN'),(100,'ESI (Semipresencial)',2,'TAL',3,3,'SCU','FGN'),(101,'EDI: Construcción de proyectos interdisciplinarios en el ámbito escolar',2,'TAL',3,3,'SCU','FGN');
/*!40000 ALTER TABLE `core_materia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `core_correlatividad`
--

DROP TABLE IF EXISTS `core_correlatividad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `core_correlatividad` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tipo` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `materia_correlativa_id` bigint NOT NULL,
  `materia_origen_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `core_correlatividad_materia_origen_id_materi_4fe85d1e_uniq` (`materia_origen_id`,`materia_correlativa_id`,`tipo`),
  KEY `core_correlatividad_materia_correlativa__e8eafdc6_fk_core_mate` (`materia_correlativa_id`),
  CONSTRAINT `core_correlatividad_materia_correlativa__e8eafdc6_fk_core_mate` FOREIGN KEY (`materia_correlativa_id`) REFERENCES `core_materia` (`id`),
  CONSTRAINT `core_correlatividad_materia_origen_id_2445f6d5_fk_core_mate` FOREIGN KEY (`materia_origen_id`) REFERENCES `core_materia` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=236 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `core_correlatividad`
--

LOCK TABLES `core_correlatividad` WRITE;
/*!40000 ALTER TABLE `core_correlatividad` DISABLE KEYS */;
INSERT INTO `core_correlatividad` VALUES (2,'RPC',1,11),(3,'APC',2,11),(1,'RPC',9,11),(5,'APR',1,12),(4,'RPC',1,12),(7,'APR',1,14),(6,'RPC',1,14),(11,'APR',1,15),(9,'RPC',1,15),(10,'APR',3,15),(8,'RPC',3,15),(15,'APR',1,16),(13,'RPC',1,16),(14,'APR',4,16),(12,'RPC',4,16),(17,'APR',9,17),(16,'RPC',9,17),(19,'APR',1,18),(18,'RPC',1,18),(21,'APR',6,19),(20,'RPC',6,19),(27,'APC',1,20),(28,'APC',5,20),(29,'APC',9,20),(30,'APC',11,20),(24,'RPC',12,20),(214,'RPC',13,20),(25,'RPC',14,20),(23,'RPC',15,20),(26,'RPC',16,20),(22,'RPC',18,20),(33,'APC',5,22),(34,'APR',5,22),(215,'APR',9,22),(31,'RPC',9,22),(216,'APR',17,22),(32,'RPC',17,22),(37,'APC',1,23),(219,'APR',1,23),(218,'APR',12,23),(36,'RPC',12,23),(217,'APR',13,23),(35,'RPC',13,23),(40,'APC',1,24),(221,'APR',1,24),(39,'APC',5,24),(41,'APR',5,24),(220,'APR',12,24),(38,'RPC',12,24),(42,'APC',1,25),(222,'APR',1,25),(44,'APR',17,27),(43,'RPC',17,27),(46,'APC',6,28),(223,'APR',6,28),(224,'APR',19,28),(45,'RPC',19,28),(47,'APC',8,29),(55,'APC',1,30),(56,'APC',2,30),(54,'APC',3,30),(49,'APC',4,30),(57,'APC',5,30),(53,'APC',6,30),(48,'APC',7,30),(50,'APC',8,30),(58,'APC',9,30),(52,'APC',10,30),(65,'APC',11,30),(63,'APC',12,30),(59,'APC',13,30),(66,'APC',14,30),(61,'APC',15,30),(62,'APC',16,30),(67,'APC',17,30),(60,'APC',18,30),(64,'APC',19,30),(76,'APC',20,30),(75,'APC',21,30),(68,'APC',22,30),(69,'APC',23,30),(70,'APC',24,30),(73,'APC',25,30),(74,'APC',26,30),(78,'APC',27,30),(77,'APC',28,30),(72,'APC',29,30),(51,'APC',37,30),(71,'APC',38,30),(79,'APC',7,31),(81,'APR',7,31),(80,'APC',20,31),(89,'APC',1,32),(90,'APC',2,32),(88,'APC',3,32),(83,'APC',4,32),(91,'APC',5,32),(87,'APC',6,32),(82,'APC',7,32),(84,'APC',8,32),(92,'APC',9,32),(86,'APC',10,32),(99,'APC',11,32),(97,'APC',12,32),(93,'APC',13,32),(100,'APC',14,32),(95,'APC',15,32),(96,'APC',16,32),(101,'APC',17,32),(94,'APC',18,32),(98,'APC',19,32),(110,'APC',20,32),(109,'APC',21,32),(102,'APC',22,32),(103,'APC',23,32),(104,'APC',24,32),(107,'APC',25,32),(108,'APC',26,32),(112,'APC',27,32),(111,'APC',28,32),(106,'APC',29,32),(85,'APC',37,32),(105,'APC',38,32),(120,'APC',1,33),(121,'APC',2,33),(119,'APC',3,33),(114,'APC',4,33),(122,'APC',5,33),(118,'APC',6,33),(113,'APC',7,33),(115,'APC',8,33),(123,'APC',9,33),(117,'APC',10,33),(130,'APC',11,33),(128,'APC',12,33),(124,'APC',13,33),(131,'APC',14,33),(126,'APC',15,33),(127,'APC',16,33),(132,'APC',17,33),(125,'APC',18,33),(129,'APC',19,33),(141,'APC',20,33),(140,'APC',21,33),(133,'APC',22,33),(134,'APC',23,33),(135,'APC',24,33),(138,'APC',25,33),(139,'APC',26,33),(143,'APC',27,33),(142,'APC',28,33),(137,'APC',29,33),(116,'APC',37,33),(136,'APC',38,33),(151,'APC',1,34),(152,'APC',2,34),(150,'APC',3,34),(145,'APC',4,34),(153,'APC',5,34),(149,'APC',6,34),(144,'APC',7,34),(146,'APC',8,34),(154,'APC',9,34),(148,'APC',10,34),(161,'APC',11,34),(159,'APC',12,34),(155,'APC',13,34),(162,'APC',14,34),(157,'APC',15,34),(158,'APC',16,34),(163,'APC',17,34),(156,'APC',18,34),(160,'APC',19,34),(172,'APC',20,34),(171,'APC',21,34),(164,'APC',22,34),(165,'APC',23,34),(166,'APC',24,34),(169,'APC',25,34),(170,'APC',26,34),(174,'APC',27,34),(173,'APC',28,34),(168,'APC',29,34),(147,'APC',37,34),(167,'APC',38,34),(182,'APC',1,35),(183,'APC',2,35),(181,'APC',3,35),(176,'APC',4,35),(184,'APC',5,35),(180,'APC',6,35),(175,'APC',7,35),(177,'APC',8,35),(185,'APC',9,35),(179,'APC',10,35),(192,'APC',11,35),(190,'APC',12,35),(186,'APC',13,35),(193,'APC',14,35),(188,'APC',15,35),(189,'APC',16,35),(194,'APC',17,35),(187,'APC',18,35),(191,'APC',19,35),(203,'APC',20,35),(202,'APC',21,35),(195,'APC',22,35),(196,'APC',23,35),(197,'APC',24,35),(200,'APC',25,35),(201,'APC',26,35),(205,'APC',27,35),(204,'APC',28,35),(199,'APC',29,35),(178,'APC',37,35),(198,'APC',38,35),(210,'APR',15,36),(206,'RPC',15,36),(211,'APR',16,36),(209,'RPC',16,36),(212,'APR',23,36),(207,'RPC',23,36),(213,'APR',24,36),(208,'RPC',24,36),(225,'RPC',41,52),(227,'RPC',44,52),(226,'RPC',45,52),(228,'RPC',49,52),(229,'RPC',41,53),(230,'RPC',41,55),(231,'RPC',44,55),(232,'RPC',49,55),(233,'RPC',46,57),(234,'RPC',49,57),(235,'RPC',47,61);
/*!40000 ALTER TABLE `core_correlatividad` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-04 13:40:38
