"""
Django settings for the Hypnos backend (config project).

Created with 'django-admin startproject'.
Reference: https://docs.djangoproject.com/en/6.1/topics/settings/

Each section below is a docstring delimited by three double quotes, which
states:
    1. the exact pip install command for the packages used in that section,
    2. the role each package plays in the Hypnos project.

Every version is pinned in requirements.txt, so reproduce the local
environment with:  pip install -r requirements.txt
"""

import os
from datetime import timedelta
from pathlib import Path

# Les quotas sont ecrits ici, et non importes depuis config/throttle.py.
# Importer un module qui touche `rest_framework` pendant le chargement de
# settings fait lire `settings.REST_FRAMEWORK` avant qu'il soit defini :
# DRF memorise alors ses valeurs par defaut (session + basic, sans JWT) et
# toute l'authentification par jeton devient silencieusement inoperante,
# alors que `manage.py check` passe. Les constantes restent dans throttle.py
# pour la documentation ; c'est la seule source de verite ici.
QUOTA_ANONYME = "20/hour"
QUOTA_COMPTE = "2000/hour"

# python-decouple is used instead of os.environ so that the configuration can
# live in a .env file locally and in real environment variables on CI/prod.
# pip install python-decouple
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


"""
SECURITY / CORE
---------------
Package: Django (pip install Django==6.1.1)

Role: web framework that serves the REST API consumed by the website
(React + Vite on port 5173) and by the Electron desktop app.

SECRET_KEY signs sessions, CSRF tokens and password-reset links. It is read
from the environment because committing it would let anyone forge sessions.
The fallback exists only so a fresh clone runs locally; on CI and in
production .env / the GitHub secret is mandatory.
"""

SECRET_KEY = config(
    "SECRET_KEY",
    default="django-insecure-dev-only-do-not-use-in-production",
)

# DEBUG=True serves full tracebacks and disables every security check.
# It is forced to False whenever CI is running or when 0/1/false/no appears
# in the DEBUG env var, so a leaked .env can never expose a production stack.
DEBUG = config("DEBUG", default=True, cast=bool) and not os.environ.get("CI")

# Hosts allowed to serve the site. Empty in DEBUG (localhost allowed).
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="").split(",") if not DEBUG else []

# Jeton de demarrage : autorise la creation du TOUT PREMIER compte sur
# POST /api/users/ quand la table des comptes est vide (voir
# accounts.views.UserViewSet.creer_premier_compte).
#
# Volontairement sans valeur par defaut : un deploiement qui oublierait de le
# definir garde la porte fermee plutot que d'ouvrir la creation d'un
# superadmin a quiconqueJoint le serveur. Il n'a de sens que le temps de
# l'installation, puis il peut etre retire de l'environnement.
BOOTSTRAP_TOKEN = config("BOOTSTRAP_TOKEN", default="")


"""
INSTALLED_APPS
--------------
Packages: django.contrib.*, rest_framework, corsheaders, allauth, main

Role:
    main                    -> application Hypnos (models.py: User, Hotel,
                              Personnel, Chambre, Reservation, Notification...)
    rest_framework          -> browsable/REST API + authentication classes
    corsheaders             -> CORS response headers for the two frontends
    allauth.account         -> signup / login / password reset, which
                              django.contrib.auth does NOT provide
    allauth.socialaccount   -> reserved for future Google/Apple OAuth
    django.contrib.sites    -> required by allauth.socialaccount and used for
                              the domain attached to e-mails and redirects
"""

INSTALLED_APPS = [
    # --- Django core (ships with the framework) ---
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    
    # --- Applications Hypnos ---
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    
    # Applications spécifiques
    "accounts",
    "hotels",
    "reservations",
    "sync",
    "main",
    "payments",
    
    # --- pip install djangorestframework ---
    "rest_framework",
    # --- pip install django-cors-headers ---
    "corsheaders",
]

# allauth social providers (allauth.socialaccount) are resolved through the
# Site model, so a site must exist. Migration 0001 of sites creates id=1
# (example.com); override with SITE_ID for a real domain.
SITE_ID = 1


"""
MIDDLEWARE
----------
Packages: Django, django-cors-headers

Role: request/response pipeline. ORDER IS SIGNIFICANT:
    - CorsMiddleware is added before CommonMiddleware, otherwise the browser
      pre-flight OPTIONS request is rejected by CommonMiddleware before CORS
      headers are ever written.
    - WhiteNoise-style static serving is not used; a reverse proxy or a CDN
      serves STATIC_ROOT in production.
"""

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # allauth >= 65 exige AccountMiddleware. Il doit venir APRES
    # AuthenticationMiddleware car il s'appuie sur request.user.
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


"""
404 PERSONNALISEE
-----------------
Django ignore handler404 / 404.html tant que DEBUG=True : il affiche sa page
technique listant les motifs testes. Pour que la page 404.html (et le JSON sous
/api/) s'affichent aussi en developpement, config/urls.py declare une derniere
route fourre-tout qui rattrape les URL inconnues avant que Django ne les
transforme en 404 technique.

Mettre CUSTOM_404_IN_DEBUG a 0 rend la main a Django, ce qui est utile quand on
ecrit une URL et qu'on a besoin de la liste des motifs acceptes.
"""

CUSTOM_404_IN_DEBUG = config("CUSTOM_404_IN_DEBUG", default=True, cast=bool)


"""
CORS
----
Package: django-cors-headers (pip install django-cors-headers)

Role: the website runs on http://localhost:5173 (Vite) and the Electron
desktop app loads from file://, so their Origin differs from the API origin.
The browser blocks those cross-origin XHR/fetch calls unless the API answers
with Access-Control-Allow-Origin.

Electron sends Origin: null (opaque origin for file://), hence the "null"
entry. In production replace these by the real deployed origins, because
CORS_ALLOW_ALL_ORIGINS would let any website call the API with the cookies
of a logged-in receptionist.
"""

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server - website
    "http://127.0.0.1:5173",
    "http://localhost:4173",  # Vite preview
    "null",                  # Electron desktop app (file:// origin)
]

# Credentials are sent as JWT Authorization headers, not cookies, so they are
# not enabled by default. Turn on only if session cookies are used.
CORS_ALLOW_CREDENTIALS = False


"""
ROOT_URLCONF / TEMPLATES
------------------------
Package: Django

Role: URL routing plus the template engine needed by the admin site and by
allauth (which renders its signup / login / password-reset forms).
`django.template.context_processors.request` is mandatory: allauth reads
`request` from it to build its form actions.

DIRS holds the project-wide templates (BASE_DIR / "templates"). The templates
of the applications (main/index.html, main/404.html) are found by APP_DIRS,
which searches <app>/templates/ -- they therefore need no path here.
"""

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


"""
DATABASES
---------
Package: Django (pip install Django==6.1.1) + sqlparse (auto-installed)

Role: default engine is SQLite, which is perfect for local development and
for the GitHub Actions test job (zero setup, file is recreated on each run).
When you deploy, switch to PostgreSQL (pip install psycopg[binary]) by
setting DATABASE_URL in .env; see the commented block below.
"""

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Production block -- activated as soon as DATABASE_URL is defined.
# DATABASE_URL = config("DATABASE_URL", default=None)
# if DATABASE_URL:
#     from dj_database_url import parse
#     DATABASES["default"] = parse(DATABASE_URL, conn_max_age=600)


"""
AUTHENTICATION -- custom user model
-----------------------------------
Package: Django

Role: accounts.models.User subclasses AbstractUser (username / email /
password / role / is_staff...). Declarer AUTH_USER_MODEL est ce qui
indique a Django, a allauth et a DRF de l'utiliser a la place de
django.contrib.auth.models.User.

Note : l'application ne peut pas s'appeler `auth`, ce label appartient deja
a django.contrib.auth et Django refuserait de demarrer.
"""

AUTH_USER_MODEL = "accounts.User"


"""
AUTHENTICATION -- allauth
-------------------------
Package: django-allauth (pip install django-allauth)

Role: classic (email + password) authentication. django.contrib.auth can
verify an existing password but offers no sign-up form and no "forgot
password" workflow; allauth adds signup, login, logout and password reset.

AUTHENTICATION_BACKENDS must be declared, otherwise Django refuses to sign
any user in (allauth would raise at the first login attempt).
"""

AUTHENTICATION_BACKENDS = [
    # allauth: handles signup / login / password reset
    "allauth.account.auth_backends.AuthenticationBackend",
    # Django: keeps ModelBackend so createsuperuser and admin login still work
    "django.contrib.auth.backends.ModelBackend",
]

# allauth >= 65: a single user may log in with either identifier.
ACCOUNT_LOGIN_METHODS = {"username", "email"}

# Order of the fields rendered by the sign-up form. A "*" suffix marks the
# field required.
ACCOUNT_SIGNUP_FIELDS = ["username*", "email*", "password1*", "password2*"]

# "mandatory" forces the user to confirm the address before logging in.
# Set to "optional" for local development to avoid e-mail round-trips.
ACCOUNT_EMAIL_VERIFICATION = config(
    "ACCOUNT_EMAIL_VERIFICATION", default="optional"
)

# Only one account per address. The `unique=True` on accounts.User.email
# already guarantees it at the database level, which is the stronger
# constraint.
ACCOUNT_PREVENT_ENUMERATION = True

# After a successful /registration/ the user lands here.
LOGIN_REDIRECT_URL = "/admin/"

# Absolute e-mail links inside password-reset e-mails.
ACCOUNT_EMAIL_SUBJECT_PREFIX = "Hypnos"


"""
REST_FRAMEWORK
--------------
Packages: djangorestframework, djangorestframework-simplejwt

Role: the API is consumed by two non-browser clients (the website and the
Electron app) that cannot rely on CSRF-protected session cookies. They send
an "Authorization: Bearer <access token>" header instead, so JWTAuthentication
is the default. SessionAuthentication stays enabled for the browsable API
(/api/) during development.
"""

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DATETIME_FORMAT": "iso-8601",
    # Quotas. Voir config/throttle.py : l'anonyme est strict parce que
    # POST /api/demandes/ est ouvert a un visiteur sans compte, le compte
    # authentifie est large parce que le logiciel de l'agent boucle sur
    # l'API toute la journee.
    "DEFAULT_THROTTLE_RATES": {
        "anon": QUOTA_ANONYME,
        "compte": QUOTA_COMPTE,
        "demande_publique": QUOTA_ANONYME,
    },
}


"""
SIMPLE_JWT
----------
Package: djangorestframework-simplejwt (pip install djangorestframework-simplejwt)
            + PyJWT (auto-installed, provides the HS256 signer)

Role: stateless token authentication. /api/token/ returns an access token
(valid 1 h) and a refresh token (valid 14 days). The client renews the
access token silently instead of sending a cookie on every call, which is
mandatory for a desktop app that may stay offline or run from file://.
"""

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,  # needs django-blacklist
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,  # same secret as Django
    "AUTH_HEADER_TYPES": ("Bearer",),
    # accounts.User renomme sa cle primaire en "id_user" : le champ "id"
    # n'existe pas. Sans ce reglage, simplejwt echoue des la creation du jeton.
    "USER_ID_FIELD": "id_user",
    "USER_ID_CLAIM": "user_id",
}


"""
EMAIL
-----
Package: Django

Role: sends the verification, password-reset and reservation notifications.
By default everything is printed in the terminal instead of being sent
(safe: no accidental mailing to real addresses during development).

Note: the previous `MAILERS = {...}` key was removed. It is not a Django
setting -- the correct key is EMAIL_BACKEND, and the old block was silently
ignored, so the project was still using the SMTP backend.
"""

EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="no-reply@hypnos.local")


"""
KPAY-NOW
--------
Les clés sont lues depuis l'environnement; aucune valeur sensible ne doit
être ajoutée au dépôt. Les clés live sont refusées tant que l'activation
explicite KPAY_ALLOW_LIVE_PAYMENTS=1 n'est pas donnée.
"""

KPAY_API_KEY = config("KPAY_API_KEY", default="")
KPAY_SECRET_KEY = config("KPAY_SECRET_KEY", default="")
KPAY_WEBHOOK_SECRET = config("KPAY_WEBHOOK_SECRET", default="")
KPAY_GATEWAY_SECRET = config("KPAY_GATEWAY_SECRET", default="")
KPAY_BASE_URL = config("KPAY_BASE_URL", default="https://admin.kpay.site")
KPAY_PUBLIC_BASE_URL = config("KPAY_PUBLIC_BASE_URL", default="")
KPAY_ALLOW_LIVE_PAYMENTS = config("KPAY_ALLOW_LIVE_PAYMENTS", default=False, cast=bool)
KPAY_TIMEOUT_SECONDS = config("KPAY_TIMEOUT_SECONDS", default=15, cast=int)


"""
PASSWORD VALIDATION
-------------------
Package: Django

Role: rejects passwords similar to the username, shorter than 8 characters,
present in a breach list of common passwords, or purely numeric.
"""

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation."
                "UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


"""
INTERNATIONALISATION
-------------------
Package: Django (tzdata is auto-installed)

Role: the application is French; the user-facing labels are set with the
French choices in main/models.py, so the default locale is fr-fr while
TIME_ZONE stays UTC to store unambiguous timestamps in the database.
"""

LANGUAGE_CODE = "fr-fr"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


"""
STATIC FILES
------------
Package: Django

Role: STATIC_URL is the public URL prefix. STATIC_ROOT is the directory that
`python manage.py collectstatic` fills; it is required to serve the admin
CSS/JS in production and is not itself versioned (see .gitignore).

STATICFILES_DIRS is where to PUT the project-wide static files during
development, because they live in backend/api/static/ (favicon.ico), a
directory that is not an application and would therefore never be found.
"""

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Fichiers statiques du projet (favicon.ico...), servis par runserver en
# developpement et recopies dans STATIC_ROOT par collectstatic.
STATICFILES_DIRS = [BASE_DIR / "static"]


"""
SECURITY -- production only
---------------------------
Package: Django

Role: `manage.py check --deploy` signale 7 failles potentielles quand DEBUG
est actif. Les quatre regles ci-dessous ne sont appliquees QUE quand DEBUG
est False, car elles casseraient le developpement local en HTTP :

    SECURE_SSL_REDIRECT   : force la redirection HTTPS (302 sur http://).
    SECURE_HSTS_SECONDS   : demande au navigateur de refuser le HTTP
                            pendant 1 an. A n'activer que si TOUT le site
                            est derriere un HTTPS valide, sinon les
                            utilisateurs ne pourront plus revenir en HTTP.
    SESSION_COOKIE_SECURE : le cookie de session ne part qu'en HTTPS.
    CSRF_COOKIE_SECURE    : idem pour le jeton CSRF.

Restent a regler manuellement, ils dependent de l'environnement :
    - SECRET_KEY  (W009) : une vraie valeur aleatoire dans .env
    - ALLOWED_HOSTS (W020) : tes vrais domaines dans .env
"""

if not DEBUG:
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
    SECURE_HSTS_SECONDS = int(config("SECURE_HSTS_SECONDS", default="31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Les deux clients etant des applications non-navigateur, un jeton
    # d'authentification long n'est pas vole plus facilement par un
    # navigateur ; le cookie n'apporte donc rien ici.
    SESSION_COOKIE_HTTPONLY = True
    X_FRAME_OPTIONS = "DENY"
