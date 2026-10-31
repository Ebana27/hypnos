from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User
from hotels.models import Hotel


class UserSerializer(serializers.ModelSerializer):
    """ LES CHAMPS SUIVANTS SERONT CONVERTIT EN JSON

    `password` est declare explicitement en write_only : le champ disparait
    donc des reponses, ce qui empeche GET /api/users de renvoyer le hash de
    tous les comptes a quiconque detient un jeton. Les serializers DRF ne
    hachat pas : sans ces deux methodes, un POST /api/users ecrirait le mot
    de passe en clair dans la colonne `password`.

    `hotel` et `role` sont exposes parce que la contrainte de base
    `user_hotel_ou_superuser` (models.py) interdit tout compte sans hotel.
    Sans ces deux champs dans `fields`, POST /api/users echouait toujours
    sur une IntegrityError, donc l'API ne pouvait creer aucun compte.
    """
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        trim_whitespace=False,
        style={'input_type': 'password'},
    )
    # PrimaryKeyRelatedField : le client envoie l'id d'un hotel existant.
    # Le queryset explicite est obligatoire, sinon DRF retomberait sur le
    # manager du model parent et proposerait des User a la place.
    hotel = serializers.PrimaryKeyRelatedField(
        queryset=Hotel.objects.all(),
        allow_null=True,
        help_text="Hotel de rattachement. Obligatoire.",
    )
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False)
    # `is_active` est visible mais PAS modifiable par cette voie : le
    # blocage passe par l'action `bloquer` de UserViewSet, qui verifie qui a
    # le droit de suspendre qui. Laisser le champ inscriptible ici
    # reviendrait a ouvrir une porte de derriere.
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = ['id_user', 'username', 'email', 'password', 'role', 'hotel', 'is_active']

    def validate(self, attrs):
        # Meme validateurs que le formulaire de creation de compte Django
        # (longueur, similarite avec le username, mots de passe courants).
        # validate_password a besoin du User pour la similarite, d'ou le
        # passage par validate() plutot que par un validateur de champ.
        password = attrs.get('password')
        if password:
            username = attrs.get('username') or getattr(
                self.instance, 'username', None
            )
            validate_password(password, User(username=username))

        # La contrainte `hotel IS NOT NULL OR is_superuser` vit au niveau
        # base : la verifier ici transforme un 500 en 400 explicite.
        # L'API ne cree jamais de superuser, donc `hotel` est toujours requis.
        if 'hotel' in attrs and attrs['hotel'] is None:
            raise serializers.ValidationError({
                'hotel': "Un compte doit etre rattache a un hotel."
            })
        if self.instance is None and attrs.get('hotel') is None:
            raise serializers.ValidationError({
                'hotel': "Un compte doit etre rattache a un hotel."
            })
        # A la creation, le mot de passe est obligatoire : sans lui, create()
        # ferait un pop() sans defaut (KeyError -> 500) et la colonne NOT NULL
        # refuserait l'insertion.
        if self.instance is None and not attrs.get('password'):
            raise serializers.ValidationError({
                'password': "Le mot de passe est obligatoire a la creation."
            })

        # Un compte ne peut pas s'attribuer lui-meme le droit d'ecrire, ni
        # changer d'hotel, ni se retirer le role qui l'autorisait. Seule
        # l'administration de la plateforme redistribue ces deux champs.
        acteur = self._acteur()
        if acteur is not None and not acteur.is_superuser:
            if 'role' in attrs:
                raise serializers.ValidationError({
                    'role': "Seul un administrateur peut attribuer un role."
                })
            # Le manager declare l'hotel de son propre compte en envoyant
            # l'identifiant : c'est redondant mais sans consequence. Ce qu'on
            # refuse, c'est de viser un autre etablissement -- c'est ce que la
            # regle "un hotel, un utilisateur" interdit.
            hotel_demande = attrs.get('hotel')
            if hotel_demande is not None and hotel_demande.pk != acteur.hotel_id:
                raise serializers.ValidationError({
                    'hotel': "Vous ne pouvez creer un compte que pour votre hotel."
                })
        return attrs

    def _acteur(self):
        """
        Le compte connecte, ou None si le serializer est utilise hors d'une
        requete HTTP (tests, shell, bootstrap).
        """
        requete = self.context.get('request')
        return getattr(requete, 'user', None) if requete else None

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        # Un PATCH sans `password` ne doit pas effacer le mot de passe.
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class BootstrapSerializer(serializers.ModelSerializer):
    """
    Creation du premier compte de l'installation (proprietaire).

    Ce serializer est volontairement etroit : `username`, `email` et
    `password`, rien d'autre. Le role et le super-pouvoir ne sont pas des
    parametres de la requete, ils sont fixes ici -- sinon n'importe qui
    discovering cette route pourrait se declarer superadmin.

    Le compte cree n'appartient a aucun hotel : c'est le proprietaire de la
    plateforme, pas un agent d'etablissement. Il cree ensuite les hotelys et
    leurs agents.
    """

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def validate_email(self, valeur):
        if User.objects.filter(email__iexact=valeur).exists():
            raise serializers.ValidationError("Cette adresse est deja utilisee.")
        return valeur

    def create(self, validated_data):
        password = validated_data.pop('password')
        compte = User(
            **validated_data,
            is_superuser=True,
            is_staff=True,
            role=User.ROLE_MANAGER,
            hotel=None,
        )
        compte.set_password(password)
        compte.save()
        return compte